"""API Routes — Signal Detection & Scanning"""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.signals import scan_stock, get_latest_signals, ALL_STRATEGIES
from app.services.data_ingestion import ingest_ohlcv
from app.services.alerts import alert_manager
from app.services.auth import require_auth
from app.services.rate_limit import limiter

router = APIRouter()


@router.get("/signals")
async def list_signals(
    symbol: Optional[str] = Query(None, description="Stock symbol e.g. RELIANCE.NS"),
    db: AsyncSession = Depends(get_db),
):
    """Get stored signals. If symbol provided, filter by stock."""
    if symbol:
        signals = await get_latest_signals(db, symbol)
    else:
        # Return recent signals across all stocks
        from sqlalchemy import select
        from app.models.signal import Signal
        result = await db.execute(
            select(Signal).order_by(Signal.created_at.desc()).limit(50)
        )
        rows = result.scalars().all()
        signals = [{
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
    return {"signals": signals, "count": len(signals)}


@router.post("/signals/scan")
@limiter.limit("20/minute")
async def scan_signals(
    request: Request,
    symbol: str = Query(..., description="Stock symbol e.g. RELIANCE.NS"),
    strategies: Optional[str] = Query(None, description="Comma-separated strategy names"),
    _user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a signal scan for a stock.
    Auto-ingests OHLCV data if not present.
    Returns detected signals with full audit trail.
    """
    _ = request, _user

    # Ensure we have data
    await ingest_ohlcv(db, symbol)

    strat_list = strategies.split(",") if strategies else None
    signals = await scan_stock(db, symbol, strategies=strat_list)

    # Broadcast via WebSocket
    for sig in signals:
        await alert_manager.send_signal_alert(sig)

    return {
        "symbol": symbol,
        "signals_detected": len(signals),
        "signals": signals,
        "strategies_run": strat_list or list(ALL_STRATEGIES.keys()),
    }


@router.get("/signals/strategies")
async def list_strategies():
    """List available signal detection strategies."""
    return {
        "strategies": [
            {"name": "ma_crossover", "description": "50/200 SMA Golden/Death Cross"},
            {"name": "rsi", "description": "RSI Overbought (>70) / Oversold (<30)"},
            {"name": "macd", "description": "MACD / Signal Line Crossover"},
            {"name": "breakout", "description": "20-day High/Low Breakout"},
            {"name": "volume_spike", "description": "Volume > 2× 20-day Average"},
        ]
    }
