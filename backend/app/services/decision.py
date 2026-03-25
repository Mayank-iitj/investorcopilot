"""Decision Engine — Combines signals + backtest + portfolio context.

Outputs: BUY / SELL / HOLD with:
  - Confidence score (based on backtest evidence)
  - Reasoning chain (every claim maps to stored data)
  
NO hallucination. No random confidence scores.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.backtest import BacktestResult
from app.models.portfolio import Holding
from app.models.signal import Signal
from app.services.data_ingestion import SECTOR_MAP

logger = logging.getLogger(__name__)


async def get_recommendation(
    db: AsyncSession,
    symbol: str,
    portfolio_id: int | None = None,
) -> dict:
    """
    Generate a recommendation for a stock.
    
    Confidence = weighted average of backtest win rates for triggered signal types.
    Action determined by majority vote of recent signals weighted by backtest performance.
    """
    # 1. Get recent signals (last 30 days)
    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(Signal)
        .where(and_(Signal.stock_symbol == symbol, Signal.created_at >= cutoff))
        .order_by(Signal.created_at.desc())
        .limit(20)
    )
    recent_signals = result.scalars().all()

    if not recent_signals:
        return {
            "symbol": symbol,
            "action": "HOLD",
            "confidence": 0.0,
            "reasoning": ["No recent signals detected — insufficient data for recommendation"],
            "signals_used": 0,
            "backtest_evidence": {},
        }

    # 2. Get backtest evidence for each signal type
    signal_types = set(s.signal_type for s in recent_signals)
    backtest_evidence = {}

    for stype in signal_types:
        result = await db.execute(
            select(BacktestResult)
            .where(and_(
                BacktestResult.strategy_name == stype,
                BacktestResult.stock_symbol == symbol,
            ))
            .order_by(BacktestResult.created_at.desc())
            .limit(1)
        )
        bt = result.scalar_one_or_none()
        if bt:
            backtest_evidence[stype] = {
                "win_rate": bt.win_rate,
                "avg_return": bt.avg_return_pct,
                "sharpe": bt.sharpe_ratio,
                "total_trades": bt.total_trades,
                "max_drawdown": bt.max_drawdown_pct,
            }

    # 3. Score: weighted vote
    buy_score = 0.0
    sell_score = 0.0
    reasoning = []

    for sig in recent_signals:
        # Weight by backtest win rate if available, else use 50%
        bt = backtest_evidence.get(sig.signal_type, {})
        win_rate = bt.get("win_rate", 50.0) / 100.0
        weight = win_rate

        if sig.direction == "BUY":
            buy_score += weight
            if bt:
                reasoning.append(
                    f"[BUY] {sig.signal_type}: {sig.rule_description} "
                    f"(backtest: {bt['win_rate']:.0f}% win rate, {bt.get('avg_return', 0):.1f}% avg return)"
                )
            else:
                reasoning.append(f"[BUY] {sig.signal_type}: {sig.rule_description} (no backtest data)")
        else:
            sell_score += weight
            if bt:
                reasoning.append(
                    f"[SELL] {sig.signal_type}: {sig.rule_description} "
                    f"(backtest: {bt['win_rate']:.0f}% win rate)"
                )
            else:
                reasoning.append(f"[SELL] {sig.signal_type}: {sig.rule_description} (no backtest data)")

    # 4. Portfolio context (if available)
    portfolio_context = None
    if portfolio_id:
        result = await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio_id)
        )
        holdings = result.scalars().all()
        if holdings:
            total_value = sum(h.quantity * h.avg_buy_price for h in holdings)
            stock_holding = next((h for h in holdings if h.stock_symbol == symbol), None)

            if stock_holding:
                weight = (stock_holding.quantity * stock_holding.avg_buy_price) / total_value * 100 if total_value > 0 else 0
                if weight > 20:
                    reasoning.append(f"[PORTFOLIO] Already {weight:.1f}% of portfolio — high concentration risk")
                    sell_score += 0.2  # slight sell bias if overweight
                else:
                    reasoning.append(f"[PORTFOLIO] Current allocation: {weight:.1f}% — room for position sizing")

            # Check sector concentration
            sector = SECTOR_MAP.get(symbol, "Unknown")
            sector_value = sum(
                h.quantity * h.avg_buy_price
                for h in holdings
                if SECTOR_MAP.get(h.stock_symbol, "Unknown") == sector
            )
            sector_pct = (sector_value / total_value * 100) if total_value > 0 else 0
            if sector_pct > 30:
                reasoning.append(f"[PORTFOLIO] {sector} sector already at {sector_pct:.1f}% — diversification concern")
                sell_score += 0.1
            else:
                reasoning.append(f"[PORTFOLIO] {sector} sector at {sector_pct:.1f}% — fits diversification")

            portfolio_context = {
                "total_holdings": len(holdings),
                "stock_weight_pct": round(
                    (stock_holding.quantity * stock_holding.avg_buy_price) / total_value * 100, 2
                ) if stock_holding and total_value > 0 else 0,
                "sector_weight_pct": round(sector_pct, 2),
            }

    # 5. Determine action
    total_score = buy_score + sell_score
    if total_score == 0:
        action = "HOLD"
        confidence = 0.0
    elif buy_score > sell_score * 1.2:
        action = "BUY"
        confidence = buy_score / total_score
    elif sell_score > buy_score * 1.2:
        action = "SELL"
        confidence = sell_score / total_score
    else:
        action = "HOLD"
        confidence = 1.0 - abs(buy_score - sell_score) / total_score

    confidence = min(1.0, max(0.0, confidence))

    # Normalize confidence using backtest evidence
    if backtest_evidence:
        avg_win = sum(v["win_rate"] for v in backtest_evidence.values()) / len(backtest_evidence)
        confidence = confidence * (avg_win / 100)

    rec = {
        "symbol": symbol,
        "action": action,
        "confidence": round(confidence, 3),
        "reasoning": reasoning,
        "signals_used": len(recent_signals),
        "backtest_evidence": backtest_evidence,
        "portfolio_context": portfolio_context,
        "latest_signal_price": recent_signals[0].price_at_signal if recent_signals else None,
    }

    # 6. Audit log
    audit = AuditLog(
        action_type="RECOMMENDATION",
        stock_symbol=symbol,
        input_data={
            "recent_signals": len(recent_signals),
            "signal_types": list(signal_types),
            "portfolio_id": portfolio_id,
        },
        rules_triggered=[s.rule_description for s in recent_signals[:5]],
        logic_used="decision_engine_v1",
        output=rec,
    )
    db.add(audit)
    await db.commit()

    return rec
