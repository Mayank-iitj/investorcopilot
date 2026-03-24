"""Backtesting Engine — Historical strategy validation with real OHLCV data.

For every strategy, compute:
  - Win rate (%)  
  - Average return per trade  
  - Max drawdown  
  - Sharpe ratio  
  - Individual trade log  

NO fake backtests. All math from pandas + numpy.
"""
import pandas as pd
import numpy as np
from datetime import date, timedelta
from typing import Optional
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backtest import BacktestResult
from app.models.audit import AuditLog
from app.services.signals import (
    detect_ma_crossover, detect_rsi_signals, detect_macd_crossover,
    detect_breakout, detect_volume_spike
)
from app.services.data_ingestion import get_prices_df, ingest_ohlcv, ensure_stock
from app.config import settings

logger = logging.getLogger(__name__)


def _compute_max_drawdown(equity_curve: pd.Series) -> float:
    """Compute max drawdown from an equity curve."""
    if equity_curve.empty:
        return 0.0
    peak = equity_curve.expanding().max()
    drawdown = (equity_curve - peak) / peak
    return float(drawdown.min()) * 100  # as percentage


def _compute_sharpe(returns: list[float], risk_free_annual: float = 0.06) -> Optional[float]:
    """Compute annualized Sharpe ratio. Indian risk-free ~ 6%."""
    if len(returns) < 2:
        return None
    arr = np.array(returns)
    mean_ret = np.mean(arr)
    std_ret = np.std(arr, ddof=1)
    if std_ret == 0:
        return None
    # Assume ~250 trading days
    trades_per_year = 250 / max(1, len(returns))
    annualized_ret = mean_ret * (250 / max(1, len(returns)))
    annualized_std = std_ret * np.sqrt(250 / max(1, len(returns)))
    return float((annualized_ret - risk_free_annual) / annualized_std)


def _simulate_trades(signals: list[dict], df: pd.DataFrame, hold_days: int = 10) -> list[dict]:
    """
    Given a list of raw signals (with 'date', 'direction', 'price'),
    simulate trades: enter at signal price, exit after `hold_days` trading days.
    Returns list of trade records.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    date_to_idx = {d.date() if hasattr(d, 'date') else d: i for i, d in enumerate(df["date"])}

    trades = []
    for sig in signals:
        sig_date = pd.Timestamp(sig["date"]).date()
        if sig_date not in date_to_idx:
            continue

        entry_idx = date_to_idx[sig_date]
        exit_idx = min(entry_idx + hold_days, len(df) - 1)

        if exit_idx <= entry_idx:
            continue

        entry_price = float(df.iloc[entry_idx]["close"])
        exit_price = float(df.iloc[exit_idx]["close"])
        exit_date = df.iloc[exit_idx]["date"]

        if sig["direction"] == "BUY":
            ret_pct = ((exit_price - entry_price) / entry_price) * 100
        else:  # SELL signal — profit if price drops
            ret_pct = ((entry_price - exit_price) / entry_price) * 100

        trades.append({
            "entry_date": str(sig_date),
            "exit_date": str(exit_date.date() if hasattr(exit_date, 'date') else exit_date),
            "direction": sig["direction"],
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "return_pct": round(ret_pct, 2),
            "rule": sig.get("rule", ""),
        })

    return trades


STRATEGY_FUNCTIONS = {
    "ma_crossover": detect_ma_crossover,
    "rsi": detect_rsi_signals,
    "macd": detect_macd_crossover,
    "breakout": detect_breakout,
    "volume_spike": detect_volume_spike,
}


async def run_backtest(
    db: AsyncSession,
    strategy: str,
    symbol: str,
    years: int = None,
    hold_days: int = 10,
) -> dict:
    """
    Run a backtest for a strategy on a stock.
    Returns computed metrics + trade log.
    """
    years = years or settings.DEFAULT_BACKTEST_YEARS

    # Ensure data exists
    stock = await ensure_stock(db, symbol)
    df = await get_prices_df(db, symbol)
    if df.empty:
        await ingest_ohlcv(db, symbol, period=f"{years}y")
        df = await get_prices_df(db, symbol)
        if df.empty:
            return {"error": f"No data available for {symbol}"}

    # Filter to backtest period
    cutoff = df.iloc[-1]["date"] - pd.Timedelta(days=years * 365)
    df_bt = df[df["date"] >= cutoff].reset_index(drop=True)
    if len(df_bt) < 50:
        return {"error": f"Insufficient data for {symbol} ({len(df_bt)} rows)"}

    # Detect signals on historical data
    func = STRATEGY_FUNCTIONS.get(strategy)
    if not func:
        return {"error": f"Unknown strategy: {strategy}"}

    raw_signals = func(df_bt)
    if not raw_signals:
        return {
            "strategy": strategy,
            "symbol": symbol,
            "period_start": str(df_bt.iloc[0]["date"]),
            "period_end": str(df_bt.iloc[-1]["date"]),
            "total_trades": 0,
            "message": "No signals generated in this period",
        }

    # Simulate trades
    trades = _simulate_trades(raw_signals, df_bt, hold_days=hold_days)
    if not trades:
        return {
            "strategy": strategy,
            "symbol": symbol,
            "total_trades": 0,
            "message": "Signals generated but no tradeable entries found",
        }

    # Compute metrics
    returns = [t["return_pct"] for t in trades]
    winning = [r for r in returns if r > 0]
    total_trades = len(trades)
    winning_trades = len(winning)
    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0.0
    avg_return = float(np.mean(returns)) if returns else 0.0
    total_return = float(np.sum(returns)) if returns else 0.0

    # Equity curve for drawdown
    equity = pd.Series([100])  # start at 100
    for r in returns:
        equity = pd.concat([equity, pd.Series([equity.iloc[-1] * (1 + r / 100)])], ignore_index=True)
    max_dd = _compute_max_drawdown(equity)
    sharpe = _compute_sharpe(returns)

    result = {
        "strategy": strategy,
        "symbol": symbol,
        "period_start": str(df_bt.iloc[0]["date"]),
        "period_end": str(df_bt.iloc[-1]["date"]),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "win_rate": round(win_rate, 2),
        "avg_return_pct": round(avg_return, 2),
        "total_return_pct": round(total_return, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 2) if sharpe is not None else None,
        "hold_period_days": hold_days,
        "trades": trades[-20:],  # last 20 trades for display
    }

    # Save to DB
    bt_record = BacktestResult(
        strategy_name=strategy,
        stock_symbol=symbol,
        period_start=df_bt.iloc[0]["date"],
        period_end=df_bt.iloc[-1]["date"],
        total_trades=total_trades,
        winning_trades=winning_trades,
        win_rate=round(win_rate, 2),
        avg_return_pct=round(avg_return, 2),
        max_drawdown_pct=round(max_dd, 2),
        sharpe_ratio=round(sharpe, 2) if sharpe else None,
        total_return_pct=round(total_return, 2),
        trade_details=trades,
    )
    db.add(bt_record)

    # Audit
    audit = AuditLog(
        action_type="BACKTEST",
        stock_symbol=symbol,
        input_data={"strategy": strategy, "years": years, "hold_days": hold_days},
        rules_triggered=[strategy],
        logic_used=f"backtest_{strategy}",
        output={"win_rate": result["win_rate"], "sharpe": result["sharpe_ratio"], "trades": total_trades},
    )
    db.add(audit)
    await db.commit()

    return result


async def get_backtest_results(db: AsyncSession, strategy: str, symbol: str = None) -> list[dict]:
    """Retrieve stored backtest results."""
    q = select(BacktestResult).where(BacktestResult.strategy_name == strategy)
    if symbol:
        q = q.where(BacktestResult.stock_symbol == symbol)
    q = q.order_by(BacktestResult.created_at.desc()).limit(20)

    result = await db.execute(q)
    rows = result.scalars().all()
    return [{
        "id": r.id,
        "strategy": r.strategy_name,
        "symbol": r.stock_symbol,
        "period": f"{r.period_start} to {r.period_end}",
        "total_trades": r.total_trades,
        "win_rate": r.win_rate,
        "avg_return_pct": r.avg_return_pct,
        "max_drawdown_pct": r.max_drawdown_pct,
        "sharpe_ratio": r.sharpe_ratio,
        "total_return_pct": r.total_return_pct,
        "created_at": str(r.created_at),
    } for r in rows]
