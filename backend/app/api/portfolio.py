"""API Routes — Portfolio Management & Analysis"""
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import csv
import io

from app.database import get_db
from app.models.portfolio import Portfolio, Holding
from app.services.portfolio import analyze_portfolio
from app.services.data_ingestion import SECTOR_MAP

router = APIRouter()


@router.post("/portfolio")
async def create_or_update_portfolio(
    holdings: list[dict] = None,
    name: str = Query("Default", description="Portfolio name"),
    db: AsyncSession = Depends(get_db),
):
    """
    Create or update a portfolio with holdings.
    
    Body: list of {"symbol": "RELIANCE.NS", "quantity": 10, "avg_buy_price": 2500, "buy_date": "2024-01-15"}
    """
    if not holdings:
        holdings = []

    # Get or create portfolio
    result = await db.execute(select(Portfolio).where(Portfolio.name == name).limit(1))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        portfolio = Portfolio(name=name)
        db.add(portfolio)
        await db.commit()
        await db.refresh(portfolio)
    else:
        # Clear existing holdings
        result = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio.id))
        old = result.scalars().all()
        for h in old:
            await db.delete(h)

    # Add new holdings
    for h in holdings:
        holding = Holding(
            portfolio_id=portfolio.id,
            stock_symbol=h["symbol"],
            quantity=h["quantity"],
            avg_buy_price=h["avg_buy_price"],
            buy_date=h.get("buy_date"),
            sector=h.get("sector") or SECTOR_MAP.get(h["symbol"], "Unknown"),
        )
        db.add(holding)

    await db.commit()
    return {"portfolio_id": portfolio.id, "name": name, "holdings_count": len(holdings)}


@router.post("/portfolio/upload-csv")
async def upload_portfolio_csv(
    file: UploadFile = File(...),
    name: str = Query("Default", description="Portfolio name"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload portfolio as CSV file.
    Expected columns: symbol, quantity, avg_buy_price, buy_date (optional), sector (optional)
    """
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    holdings = []
    for row in reader:
        holdings.append({
            "symbol": row["symbol"].strip(),
            "quantity": int(row["quantity"]),
            "avg_buy_price": float(row["avg_buy_price"]),
            "buy_date": row.get("buy_date", "").strip() or None,
            "sector": row.get("sector", "").strip() or None,
        })

    # Reuse the create endpoint logic
    result = await db.execute(select(Portfolio).where(Portfolio.name == name).limit(1))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        portfolio = Portfolio(name=name)
        db.add(portfolio)
        await db.commit()
        await db.refresh(portfolio)
    else:
        result = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio.id))
        old = result.scalars().all()
        for h in old:
            await db.delete(h)

    for h in holdings:
        holding = Holding(
            portfolio_id=portfolio.id,
            stock_symbol=h["symbol"],
            quantity=h["quantity"],
            avg_buy_price=h["avg_buy_price"],
            buy_date=h.get("buy_date"),
            sector=h.get("sector") or SECTOR_MAP.get(h["symbol"], "Unknown"),
        )
        db.add(holding)

    await db.commit()
    return {
        "portfolio_id": portfolio.id,
        "name": name,
        "holdings_count": len(holdings),
        "holdings": holdings,
    }


@router.get("/portfolio-analysis")
async def get_portfolio_analysis(
    portfolio_id: int = Query(1, description="Portfolio ID"),
    db: AsyncSession = Depends(get_db),
):
    """Run full portfolio analysis — sector allocation, risk, XIRR, volatility, correlation."""
    analysis = await analyze_portfolio(db, portfolio_id)
    return analysis


@router.get("/portfolio/{portfolio_id}")
async def get_portfolio(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio holdings."""
    result = await db.execute(select(Portfolio).where(Portfolio.id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        return {"error": "Portfolio not found"}

    result = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio_id))
    holdings = result.scalars().all()

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "holdings": [{
            "symbol": h.stock_symbol,
            "quantity": h.quantity,
            "avg_buy_price": h.avg_buy_price,
            "buy_date": str(h.buy_date) if h.buy_date else None,
            "sector": h.sector,
        } for h in holdings],
    }
