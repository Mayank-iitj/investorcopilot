"""API Routes — Backtesting"""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.backtester import run_backtest, get_backtest_results
from app.services.auth import require_auth
from app.services.rate_limit import limiter

router = APIRouter()


@router.get("/backtest/{strategy}")
async def get_backtest(
    strategy: str,
    symbol: Optional[str] = Query(None, description="Filter by stock symbol"),
    db: AsyncSession = Depends(get_db),
):
    """Get stored backtest results for a strategy."""
    results = await get_backtest_results(db, strategy, symbol)
    return {"strategy": strategy, "results": results, "count": len(results)}


@router.post("/backtest/run")
@limiter.limit("20/minute")
async def execute_backtest(
    request: Request,
    strategy: str = Query(..., description="Strategy name: ma_crossover, rsi, macd, breakout, volume_spike"),
    symbol: str = Query(..., description="Stock symbol e.g. RELIANCE.NS"),
    years: int = Query(2, description="Number of years to backtest"),
    hold_days: int = Query(10, description="Hold period in trading days"),
    _user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Run a backtest for a strategy on a stock.
    Returns: win rate, avg return, max drawdown, Sharpe ratio, trade log.
    All computed from real historical OHLCV data.
    """
    _ = request, _user

    result = await run_backtest(db, strategy, symbol, years=years, hold_days=hold_days)
    return result


@router.get("/backtest/impact-model")
async def impact_model(
    db: AsyncSession = Depends(get_db),
):
    """
    Compute overall impact model across all backtested strategies.
    Shows: if user followed signals → X% return.
    """
    from sqlalchemy import select
    from app.models.backtest import BacktestResult
    
    result = await db.execute(select(BacktestResult).order_by(BacktestResult.created_at.desc()).limit(100))
    all_results = result.scalars().all()
    
    if not all_results:
        return {"message": "No backtest results yet. Run backtests first."}
    
    total_signals = sum(r.total_trades for r in all_results)
    total_profitable = sum(r.winning_trades for r in all_results)
    avg_win_rate = sum(r.win_rate for r in all_results) / len(all_results)
    avg_return = sum(r.avg_return_pct for r in all_results) / len(all_results)
    
    strategies_tested = list(set(r.strategy_name for r in all_results))
    stocks_tested = list(set(r.stock_symbol for r in all_results))
    
    return {
        "impact_model": {
            "total_signals_tested": total_signals,
            "profitable_signals": total_profitable,
            "overall_win_rate_pct": round(avg_win_rate, 2),
            "avg_return_per_trade_pct": round(avg_return, 2),
            "projected_return_if_followed": f"{round(avg_return * (total_signals / max(len(all_results), 1)), 2)}% cumulative",
            "strategies_tested": strategies_tested,
            "stocks_tested": stocks_tested,
            "backtest_count": len(all_results),
        }
    }
