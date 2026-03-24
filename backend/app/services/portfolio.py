"""Portfolio Analyzer — Real computations on user holdings.

Computes:
  - Sector allocation  
  - Risk concentration  
  - XIRR (real Newton's method via scipy)  
  - Volatility (annualized)  
  - Beta (covariance / variance)  
  - Correlation matrix  
"""
import pandas as pd
import numpy as np
from scipy.optimize import brentq
from datetime import date, timedelta, datetime
from typing import Optional
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import Portfolio, Holding
from app.services.data_ingestion import fetch_ohlcv_sync, SECTOR_MAP, get_prices_df, ensure_stock

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
#  XIRR Computation (real formula, NOT fake)
# ──────────────────────────────────────────────────────────────

def compute_xirr(cashflows: list[tuple[date, float]], guess: float = 0.1) -> Optional[float]:
    """
    Compute XIRR (Extended Internal Rate of Return).
    cashflows: list of (date, amount) tuples. Negative = outflow, positive = inflow.
    Returns annual rate as decimal (e.g., 0.15 = 15%).
    """
    if len(cashflows) < 2:
        return None

    dates = [cf[0] for cf in cashflows]
    amounts = [cf[1] for cf in cashflows]
    d0 = min(dates)

    def xnpv(rate):
        return sum(
            amt / (1 + rate) ** ((d - d0).days / 365.25)
            for d, amt in cashflows
        )

    try:
        return float(brentq(xnpv, -0.99, 10.0, maxiter=1000))
    except Exception:
        return None


# ──────────────────────────────────────────────────────────────
#  Portfolio Analysis Functions
# ──────────────────────────────────────────────────────────────

def compute_sector_allocation(holdings: list[dict]) -> dict:
    """Compute % allocation per sector."""
    total_value = sum(h["quantity"] * h["current_price"] for h in holdings)
    if total_value == 0:
        return {}

    sectors = {}
    for h in holdings:
        sector = h.get("sector", "Unknown")
        value = h["quantity"] * h["current_price"]
        sectors[sector] = sectors.get(sector, 0) + value

    return {s: round((v / total_value) * 100, 2) for s, v in sorted(sectors.items(), key=lambda x: -x[1])}


def compute_risk_concentration(holdings: list[dict]) -> dict:
    """Assess concentration risk — flag if any stock > 20% or sector > 40%."""
    total_value = sum(h["quantity"] * h["current_price"] for h in holdings)
    if total_value == 0:
        return {"risk_level": "N/A"}

    stock_weights = {}
    sector_weights = {}
    for h in holdings:
        value = h["quantity"] * h["current_price"]
        weight = (value / total_value) * 100
        stock_weights[h["symbol"]] = round(weight, 2)
        sector = h.get("sector", "Unknown")
        sector_weights[sector] = sector_weights.get(sector, 0) + weight

    # Find concentrations
    max_stock = max(stock_weights.items(), key=lambda x: x[1])
    max_sector = max(sector_weights.items(), key=lambda x: x[1])

    risk_level = "LOW"
    warnings = []
    if max_stock[1] > 20:
        risk_level = "MEDIUM"
        warnings.append(f"{max_stock[0]} is {max_stock[1]:.1f}% of portfolio (>20%)")
    if max_sector[1] > 40:
        risk_level = "HIGH"
        warnings.append(f"{max_sector[0]} sector is {max_sector[1]:.1f}% of portfolio (>40%)")
    if max_stock[1] > 35:
        risk_level = "HIGH"

    return {
        "risk_level": risk_level,
        "warnings": warnings,
        "stock_weights": stock_weights,
        "sector_weights": {k: round(v, 2) for k, v in sector_weights.items()},
    }


def compute_volatility(returns: pd.Series) -> float:
    """Compute annualized volatility from daily returns."""
    if returns.empty or len(returns) < 2:
        return 0.0
    return float(returns.std() * np.sqrt(252) * 100)


def compute_beta(stock_returns: pd.Series, market_returns: pd.Series) -> Optional[float]:
    """Compute beta = Cov(stock, market) / Var(market)."""
    if len(stock_returns) < 10 or len(market_returns) < 10:
        return None
    # Align series
    aligned = pd.DataFrame({"stock": stock_returns, "market": market_returns}).dropna()
    if len(aligned) < 10:
        return None
    cov = aligned["stock"].cov(aligned["market"])
    var = aligned["market"].var()
    if var == 0:
        return None
    return float(cov / var)


def compute_correlation_matrix(returns_dict: dict[str, pd.Series]) -> dict:
    """Compute pairwise correlation between holdings."""
    df = pd.DataFrame(returns_dict).dropna()
    if df.empty or len(df) < 10:
        return {}
    corr = df.corr()
    return {col: {idx: round(val, 3) for idx, val in corr[col].items()} for col in corr.columns}


# ──────────────────────────────────────────────────────────────
#  Full Portfolio Analysis (DB-integrated)
# ──────────────────────────────────────────────────────────────

async def analyze_portfolio(db: AsyncSession, portfolio_id: int) -> dict:
    """Run full analysis on a portfolio."""
    result = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio_id))
    holdings_db = result.scalars().all()

    if not holdings_db:
        return {"error": "No holdings found in this portfolio"}

    # Build enriched holdings with current prices
    enriched = []
    returns_dict = {}

    for h in holdings_db:
        symbol = h.stock_symbol
        try:
            df = await get_prices_df(db, symbol)
            if df.empty:
                from app.services.data_ingestion import ingest_ohlcv
                await ingest_ohlcv(db, symbol, period="1y")
                df = await get_prices_df(db, symbol)

            current_price = float(df.iloc[-1]["close"]) if not df.empty else h.avg_buy_price
            daily_returns = df["close"].pct_change().dropna() if not df.empty else pd.Series()

            if not daily_returns.empty:
                returns_dict[symbol] = daily_returns.values

            sector = h.sector or SECTOR_MAP.get(symbol, "Unknown")
        except Exception as e:
            logger.warning(f"Error fetching data for {symbol}: {e}")
            current_price = h.avg_buy_price
            sector = h.sector or "Unknown"
            daily_returns = pd.Series()

        enriched.append({
            "symbol": symbol,
            "quantity": h.quantity,
            "avg_buy_price": h.avg_buy_price,
            "current_price": current_price,
            "sector": sector,
            "gain_pct": round(((current_price - h.avg_buy_price) / h.avg_buy_price) * 100, 2),
            "value": round(h.quantity * current_price, 2),
            "cost": round(h.quantity * h.avg_buy_price, 2),
        })

    total_value = sum(h["value"] for h in enriched)
    total_cost = sum(h["cost"] for h in enriched)

    # Sector allocation
    sector_alloc = compute_sector_allocation(enriched)

    # Risk concentration
    risk = compute_risk_concentration(enriched)

    # Portfolio-level volatility (weighted)
    portfolio_vol = None
    if returns_dict:
        weights = []
        ret_arrays = []
        for h in enriched:
            if h["symbol"] in returns_dict:
                weights.append(h["value"] / total_value if total_value > 0 else 0)
                ret_arrays.append(returns_dict[h["symbol"]])
        if ret_arrays:
            min_len = min(len(r) for r in ret_arrays)
            aligned = np.array([r[-min_len:] for r in ret_arrays])
            w = np.array(weights[:len(ret_arrays)])
            w = w / w.sum() if w.sum() > 0 else w
            port_returns = aligned.T @ w
            portfolio_vol = float(np.std(port_returns) * np.sqrt(252) * 100)

    # Correlation matrix
    corr_dict = {}
    if len(returns_dict) >= 2:
        min_len = min(len(v) for v in returns_dict.values())
        corr_df = pd.DataFrame({k: v[-min_len:] for k, v in returns_dict.items()})
        corr = corr_df.corr()
        corr_dict = {col: {idx: round(val, 3) for idx, val in corr[col].items()} for col in corr.columns}

    # XIRR estimate
    xirr_val = None
    if total_cost > 0:
        buy_date = min(h.buy_date for h in holdings_db if h.buy_date) if any(h.buy_date for h in holdings_db) else date.today() - timedelta(days=365)
        cashflows = [
            (buy_date, -total_cost),
            (date.today(), total_value),
        ]
        xirr_val = compute_xirr(cashflows)

    return {
        "portfolio_id": portfolio_id,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_gain_pct": round(((total_value - total_cost) / total_cost) * 100, 2) if total_cost > 0 else 0,
        "holdings": enriched,
        "sector_allocation": sector_alloc,
        "risk": risk,
        "portfolio_volatility_annual_pct": round(portfolio_vol, 2) if portfolio_vol else None,
        "xirr_annual_pct": round(xirr_val * 100, 2) if xirr_val else None,
        "correlation_matrix": corr_dict,
    }
