"""API Routes — Recommendations & Audit"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.services.decision import get_recommendation
from app.models.audit import AuditLog

router = APIRouter()


@router.get("/recommendation/{stock}")
async def recommend(
    stock: str,
    portfolio_id: Optional[int] = Query(None, description="Portfolio ID for context"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get AI recommendation for a stock.
    Combines: active signals + backtest performance + portfolio context.
    Returns: BUY/SELL/HOLD + confidence score + reasoning chain.
    """
    rec = await get_recommendation(db, stock, portfolio_id=portfolio_id)
    return rec


@router.get("/audit")
async def audit_log(
    action_type: Optional[str] = Query(None, description="Filter: SIGNAL, RECOMMENDATION, BACKTEST"),
    symbol: Optional[str] = Query(None, description="Filter by stock symbol"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Full audit trail — every decision is logged and queryable."""
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action_type:
        q = q.where(AuditLog.action_type == action_type)
    if symbol:
        q = q.where(AuditLog.stock_symbol == symbol)

    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "audit_logs": [{
            "id": l.id,
            "action": l.action_type,
            "stock": l.stock_symbol,
            "input": l.input_data,
            "rules": l.rules_triggered,
            "logic": l.logic_used,
            "output": l.output,
            "timestamp": str(l.created_at),
        } for l in logs],
        "count": len(logs),
    }


@router.get("/market-overview")
async def market_overview(db: AsyncSession = Depends(get_db)):
    """Quick market overview — top indices via yfinance."""
    import yfinance as yf

    indices = {
        "NIFTY_50": "^NSEI",
        "SENSEX": "^BSESN",
        "BANK_NIFTY": "^NSEBANK",
        "NIFTY_IT": "^CNXIT",
    }

    overview = {}
    for name, ticker in indices.items():
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                close = float(hist.iloc[-1]["Close"])
                prev = float(hist.iloc[-2]["Close"])
                change = ((close - prev) / prev) * 100
                overview[name] = {
                    "value": round(close, 2),
                    "change_pct": round(change, 2),
                    "direction": "up" if change > 0 else "down",
                }
            elif len(hist) == 1:
                overview[name] = {"value": round(float(hist.iloc[-1]["Close"]), 2)}
        except Exception:
            overview[name] = {"error": "unavailable"}

    return {"market_overview": overview}
