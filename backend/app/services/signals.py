"""Signal Detection Engine — Real technical + event-based signal generation.

Every signal is computed from actual OHLCV data, with:
  - Exact rule description
  - Data snapshot (JSON) for audit
  - Timestamp
"""
import logging

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.audit import AuditLog
from app.models.signal import Signal
from app.services.data_ingestion import ensure_stock, get_prices_df

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
#  Technical Indicator Computations (pure math, no fakes)
# ──────────────────────────────────────────────────────────────

def compute_sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()


def compute_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def compute_macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema12 = compute_ema(close, 12)
    ema26 = compute_ema(close, 26)
    macd_line = ema12 - ema26
    signal_line = compute_ema(macd_line, 9)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


# ──────────────────────────────────────────────────────────────
#  Signal Detectors
# ──────────────────────────────────────────────────────────────

def detect_ma_crossover(df: pd.DataFrame, short: int = None, long: int = None) -> list[dict]:
    """Detect Moving Average crossovers (golden cross / death cross)."""
    short = short or settings.MA_SHORT
    long_ = long or settings.MA_LONG
    if len(df) < long_:
        return []

    df = df.copy()
    df["sma_short"] = compute_sma(df["close"], short)
    df["sma_long"] = compute_sma(df["close"], long_)
    df = df.dropna(subset=["sma_short", "sma_long"])

    signals = []
    for i in range(1, len(df)):
        prev_short = df.iloc[i - 1]["sma_short"]
        prev_long = df.iloc[i - 1]["sma_long"]
        curr_short = df.iloc[i]["sma_short"]
        curr_long = df.iloc[i]["sma_long"]

        if prev_short <= prev_long and curr_short > curr_long:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "BUY",
                "rule": f"Golden Cross: SMA{short} ({curr_short:.2f}) crossed above SMA{long_} ({curr_long:.2f})",
                "price": float(df.iloc[i]["close"]),
                "snapshot": {
                    f"sma_{short}": round(curr_short, 2),
                    f"sma_{long_}": round(curr_long, 2),
                    "close": round(float(df.iloc[i]["close"]), 2),
                },
            })
        elif prev_short >= prev_long and curr_short < curr_long:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "SELL",
                "rule": f"Death Cross: SMA{short} ({curr_short:.2f}) crossed below SMA{long_} ({curr_long:.2f})",
                "price": float(df.iloc[i]["close"]),
                "snapshot": {
                    f"sma_{short}": round(curr_short, 2),
                    f"sma_{long_}": round(curr_long, 2),
                    "close": round(float(df.iloc[i]["close"]), 2),
                },
            })
    return signals


def detect_rsi_signals(df: pd.DataFrame, period: int = 14) -> list[dict]:
    """Detect RSI overbought/oversold conditions."""
    if len(df) < period + 1:
        return []

    df = df.copy()
    df["rsi"] = compute_rsi(df["close"], period)
    df = df.dropna(subset=["rsi"])

    signals = []
    for i in range(1, len(df)):
        rsi_val = df.iloc[i]["rsi"]
        prev_rsi = df.iloc[i - 1]["rsi"]

        # Crossing into oversold → BUY signal
        if prev_rsi >= settings.RSI_OVERSOLD and rsi_val < settings.RSI_OVERSOLD:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "BUY",
                "rule": f"RSI crossed below {settings.RSI_OVERSOLD} (RSI = {rsi_val:.2f}) — oversold condition",
                "price": float(df.iloc[i]["close"]),
                "strength": round(max(0, (settings.RSI_OVERSOLD - rsi_val) / settings.RSI_OVERSOLD), 3),
                "snapshot": {"rsi": round(rsi_val, 2), "close": round(float(df.iloc[i]["close"]), 2)},
            })
        # Crossing into overbought → SELL signal
        elif prev_rsi <= settings.RSI_OVERBOUGHT and rsi_val > settings.RSI_OVERBOUGHT:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "SELL",
                "rule": f"RSI crossed above {settings.RSI_OVERBOUGHT} (RSI = {rsi_val:.2f}) — overbought condition",
                "price": float(df.iloc[i]["close"]),
                "strength": round(max(0, (rsi_val - settings.RSI_OVERBOUGHT) / (100 - settings.RSI_OVERBOUGHT)), 3),
                "snapshot": {"rsi": round(rsi_val, 2), "close": round(float(df.iloc[i]["close"]), 2)},
            })
    return signals


def detect_macd_crossover(df: pd.DataFrame) -> list[dict]:
    """Detect MACD line / signal line crossovers."""
    if len(df) < 35:
        return []

    df = df.copy()
    macd_line, signal_line, histogram = compute_macd(df["close"])
    df["macd"] = macd_line
    df["macd_signal"] = signal_line
    df = df.dropna(subset=["macd", "macd_signal"])

    signals = []
    for i in range(1, len(df)):
        prev_macd = df.iloc[i - 1]["macd"]
        prev_sig = df.iloc[i - 1]["macd_signal"]
        curr_macd = df.iloc[i]["macd"]
        curr_sig = df.iloc[i]["macd_signal"]

        if prev_macd <= prev_sig and curr_macd > curr_sig:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "BUY",
                "rule": f"MACD ({curr_macd:.2f}) crossed above Signal ({curr_sig:.2f})",
                "price": float(df.iloc[i]["close"]),
                "snapshot": {
                    "macd": round(curr_macd, 2),
                    "signal": round(curr_sig, 2),
                    "close": round(float(df.iloc[i]["close"]), 2),
                },
            })
        elif prev_macd >= prev_sig and curr_macd < curr_sig:
            signals.append({
                "date": str(df.iloc[i]["date"]),
                "direction": "SELL",
                "rule": f"MACD ({curr_macd:.2f}) crossed below Signal ({curr_sig:.2f})",
                "price": float(df.iloc[i]["close"]),
                "snapshot": {
                    "macd": round(curr_macd, 2),
                    "signal": round(curr_sig, 2),
                    "close": round(float(df.iloc[i]["close"]), 2),
                },
            })
    return signals


def detect_breakout(df: pd.DataFrame, window: int = None) -> list[dict]:
    """Detect breakout above N-day high or breakdown below N-day low."""
    window = window or settings.BREAKOUT_WINDOW
    if len(df) < window + 1:
        return []

    df = df.copy()
    df["high_max"] = df["high"].rolling(window=window).max().shift(1)
    df["low_min"] = df["low"].rolling(window=window).min().shift(1)
    df = df.dropna(subset=["high_max", "low_min"])

    signals = []
    for i in range(len(df)):
        row = df.iloc[i]
        if row["close"] > row["high_max"]:
            signals.append({
                "date": str(row["date"]),
                "direction": "BUY",
                "rule": f"Breakout: Close ({row['close']:.2f}) above {window}-day high ({row['high_max']:.2f})",
                "price": float(row["close"]),
                "snapshot": {
                    f"{window}d_high": round(float(row["high_max"]), 2),
                    "close": round(float(row["close"]), 2),
                },
            })
        elif row["close"] < row["low_min"]:
            signals.append({
                "date": str(row["date"]),
                "direction": "SELL",
                "rule": f"Breakdown: Close ({row['close']:.2f}) below {window}-day low ({row['low_min']:.2f})",
                "price": float(row["close"]),
                "snapshot": {
                    f"{window}d_low": round(float(row["low_min"]), 2),
                    "close": round(float(row["close"]), 2),
                },
            })
    return signals


def detect_volume_spike(df: pd.DataFrame, threshold: float = None) -> list[dict]:
    """Detect abnormal volume spikes (volume > threshold × 20-day avg)."""
    threshold = threshold or settings.VOLUME_SPIKE_THRESHOLD
    if len(df) < 21:
        return []

    df = df.copy()
    df["vol_avg20"] = df["volume"].rolling(window=20).mean().shift(1)
    df = df.dropna(subset=["vol_avg20"])

    signals = []
    for i in range(len(df)):
        row = df.iloc[i]
        if row["vol_avg20"] > 0 and row["volume"] > threshold * row["vol_avg20"]:
            ratio = row["volume"] / row["vol_avg20"]
            direction = "BUY" if row["close"] > row["open"] else "SELL"
            signals.append({
                "date": str(row["date"]),
                "direction": direction,
                "rule": f"Volume spike: {row['volume']:,.0f} = {ratio:.1f}× 20-day avg ({row['vol_avg20']:,.0f})",
                "price": float(row["close"]),
                "strength": min(1.0, round((ratio - threshold) / threshold, 3)),
                "snapshot": {
                    "volume": int(row["volume"]),
                    "avg_volume_20d": round(float(row["vol_avg20"]), 0),
                    "ratio": round(ratio, 2),
                    "close": round(float(row["close"]), 2),
                },
            })
    return signals


# ──────────────────────────────────────────────────────────────
#  Unified Scanner
# ──────────────────────────────────────────────────────────────

ALL_STRATEGIES = {
    "ma_crossover": detect_ma_crossover,
    "rsi": detect_rsi_signals,
    "macd": detect_macd_crossover,
    "breakout": detect_breakout,
    "volume_spike": detect_volume_spike,
}


async def scan_stock(db: AsyncSession, symbol: str, strategies: list[str] = None, days_back: int = 30) -> list[dict]:
    """
    Run all (or selected) strategies on a stock.
    Returns only RECENT signals (last `days_back` trading days).
    Saves each signal to DB with full audit trail.
    """
    stock = await ensure_stock(db, symbol)
    df = await get_prices_df(db, symbol)

    if df.empty:
        # Auto-ingest if no data
        from app.services.data_ingestion import ingest_ohlcv
        await ingest_ohlcv(db, symbol)
        df = await get_prices_df(db, symbol)
        if df.empty:
            return []

    strategies_to_run = strategies or list(ALL_STRATEGIES.keys())
    all_signals = []

    # Only return signals from the last N trading days
    cutoff_date = df.iloc[-1]["date"] - pd.Timedelta(days=days_back) if len(df) > 0 else None

    for strategy_name in strategies_to_run:
        func = ALL_STRATEGIES.get(strategy_name)
        if not func:
            continue
        raw = func(df)
        for sig in raw:
            sig_date = pd.Timestamp(sig["date"]).date() if isinstance(sig["date"], str) else sig["date"]
            if cutoff_date is not None and sig_date < cutoff_date.date() if hasattr(cutoff_date, 'date') else sig_date < cutoff_date:
                continue

            # Save to DB
            signal_obj = Signal(
                stock_id=stock.id,
                stock_symbol=symbol,
                signal_type=strategy_name,
                direction=sig["direction"],
                strength=sig.get("strength"),
                rule_description=sig["rule"],
                data_snapshot=sig.get("snapshot"),
                price_at_signal=sig.get("price"),
            )
            db.add(signal_obj)

            # Audit log
            audit = AuditLog(
                action_type="SIGNAL",
                stock_symbol=symbol,
                input_data={"strategy": strategy_name, "date": sig["date"]},
                rules_triggered=[sig["rule"]],
                logic_used=strategy_name,
                output=sig,
            )
            db.add(audit)

            all_signals.append({
                "stock": symbol,
                "type": strategy_name,
                **sig,
            })

    await db.commit()
    return all_signals


async def get_latest_signals(db: AsyncSession, symbol: str) -> list[dict]:
    """Get stored signals for a stock (latest first)."""
    from sqlalchemy import select as sel
    result = await db.execute(
        sel(Signal)
        .where(Signal.stock_symbol == symbol)
        .order_by(Signal.created_at.desc())
        .limit(50)
    )
    rows = result.scalars().all()
    return [{
        "id": r.id,
        "stock": r.stock_symbol,
        "type": r.signal_type,
        "direction": r.direction,
        "strength": r.strength,
        "rule": r.rule_description,
        "price": r.price_at_signal,
        "snapshot": r.data_snapshot,
        "created_at": str(r.created_at),
    } for r in rows]
