"""Data Ingestion Engine — Real data from yfinance, Google News RSS, NSE filings."""
import asyncio
import logging
from datetime import datetime

import feedparser
import pandas as pd
import requests
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.stock import CorporateFiling, NewsArticle, Stock, StockPrice

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
#  OHLCV Data (yfinance)
# ──────────────────────────────────────────────────────────────

SECTOR_MAP = {
    "RELIANCE.NS": "Energy", "TCS.NS": "IT", "INFY.NS": "IT",
    "HDFCBANK.NS": "Banking", "ICICIBANK.NS": "Banking",
    "HINDUNILVR.NS": "FMCG", "ITC.NS": "FMCG",
    "SBIN.NS": "Banking", "BHARTIARTL.NS": "Telecom",
    "KOTAKBANK.NS": "Banking", "LT.NS": "Infrastructure",
    "AXISBANK.NS": "Banking", "WIPRO.NS": "IT",
    "BAJFINANCE.NS": "Finance", "MARUTI.NS": "Automobile",
    "TATAMOTORS.NS": "Automobile", "SUNPHARMA.NS": "Pharma",
    "TITAN.NS": "Consumer Goods", "ULTRACEMCO.NS": "Cement",
    "NESTLEIND.NS": "FMCG", "ADANIENT.NS": "Conglomerate",
    "HCLTECH.NS": "IT", "TECHM.NS": "IT",
    "POWERGRID.NS": "Power", "NTPC.NS": "Power",
    "ONGC.NS": "Energy", "COALINDIA.NS": "Mining",
    "DRREDDY.NS": "Pharma", "CIPLA.NS": "Pharma",
    "DIVISLAB.NS": "Pharma", "HEROMOTOCO.NS": "Automobile",
}


def fetch_ohlcv_sync(symbol: str, period: str = "2y") -> pd.DataFrame:
    """Fetch OHLCV data via yfinance (synchronous). Returns DataFrame."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, auto_adjust=True)
    if df.empty:
        logger.warning(f"No data for {symbol}")
        return df
    df = df.reset_index()
    df.columns = [c.lower() for c in df.columns]
    return df


def get_stock_info_sync(symbol: str) -> dict:
    """Get basic stock info from yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "name": info.get("longName") or info.get("shortName", symbol),
            "sector": info.get("sector") or SECTOR_MAP.get(symbol, "Unknown"),
            "exchange": "NSE" if symbol.endswith(".NS") else "BSE",
        }
    except Exception:
        return {
            "name": symbol.replace(".NS", "").replace(".BO", ""),
            "sector": SECTOR_MAP.get(symbol, "Unknown"),
            "exchange": "NSE" if symbol.endswith(".NS") else "BSE",
        }


async def ensure_stock(db: AsyncSession, symbol: str) -> Stock:
    """Get or create a Stock record."""
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()
    if stock:
        return stock

    info = await asyncio.wait_for(
        asyncio.to_thread(get_stock_info_sync, symbol),
        timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS,
    )
    stock = Stock(
        symbol=symbol,
        name=info["name"],
        sector=info["sector"],
        exchange=info["exchange"],
    )
    db.add(stock)
    await db.commit()
    await db.refresh(stock)
    return stock


async def ingest_ohlcv(db: AsyncSession, symbol: str, period: str = "2y") -> int:
    """Fetch and store OHLCV data. Returns count of rows stored."""
    stock = await ensure_stock(db, symbol)
    df = await asyncio.wait_for(
        asyncio.to_thread(fetch_ohlcv_sync, symbol, period),
        timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS,
    )
    if df.empty:
        return 0

    # Find latest date already stored
    result = await db.execute(
        select(StockPrice.date)
        .where(StockPrice.stock_id == stock.id)
        .order_by(StockPrice.date.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    count = 0
    for _, row in df.iterrows():
        row_date = row["date"].date() if hasattr(row["date"], "date") else row["date"]
        if latest and row_date <= latest:
            continue
        price = StockPrice(
            stock_id=stock.id,
            date=row_date,
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=int(row["volume"]),
            source="yfinance",
        )
        db.add(price)
        count += 1

    if count > 0:
        await db.commit()
    logger.info(f"Ingested {count} new rows for {symbol}")
    return count


async def get_prices_df(db: AsyncSession, symbol: str) -> pd.DataFrame:
    """Retrieve stored prices as a pandas DataFrame, sorted by date."""
    result = await db.execute(
        select(Stock).where(Stock.symbol == symbol)
    )
    stock = result.scalar_one_or_none()
    if not stock:
        return pd.DataFrame()

    result = await db.execute(
        select(StockPrice)
        .where(StockPrice.stock_id == stock.id)
        .order_by(StockPrice.date.asc())
    )
    rows = result.scalars().all()
    if not rows:
        return pd.DataFrame()

    data = [{
        "date": r.date,
        "open": r.open,
        "high": r.high,
        "low": r.low,
        "close": r.close,
        "volume": r.volume,
    } for r in rows]
    return pd.DataFrame(data)


# ──────────────────────────────────────────────────────────────
#  News (Google News RSS)
# ──────────────────────────────────────────────────────────────

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}+stock+india&hl=en-IN&gl=IN&ceid=IN:en"


async def fetch_news(db: AsyncSession, query: str, limit: int = 20) -> list[dict]:
    """Fetch latest news from Google News RSS. Stores in DB."""
    url = GOOGLE_NEWS_RSS.format(query=query.replace(" ", "+"))
    feed = await asyncio.wait_for(
        asyncio.to_thread(feedparser.parse, url),
        timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS,
    )

    articles = []
    for entry in feed.entries[:limit]:
        pub_date = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            pub_date = datetime(*entry.published_parsed[:6])

        article = NewsArticle(
            stock_symbol=query.replace(".NS", "").replace(".BO", ""),
            headline=entry.title,
            source=entry.get("source", {}).get("title", "Google News"),
            url=entry.link,
            published_at=pub_date,
        )
        db.add(article)
        articles.append({
            "headline": entry.title,
            "source": entry.get("source", {}).get("title", "Google News"),
            "url": entry.link,
            "published_at": str(pub_date) if pub_date else None,
        })

    await db.commit()
    return articles


# ──────────────────────────────────────────────────────────────
#  Corporate Filings (NSE scraping)
# ──────────────────────────────────────────────────────────────

NSE_ANNOUNCEMENTS_URL = "https://www.nseindia.com/api/corporate-announcements?index=equities&symbol={symbol}"
NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://www.nseindia.com/",
}


async def fetch_filings(db: AsyncSession, symbol: str) -> list[dict]:
    """Attempt to fetch corporate filings from NSE. Gracefully degrades."""
    clean_symbol = symbol.replace(".NS", "").replace(".BO", "")
    filings = []

    try:
        session = requests.Session()
        # Need to visit main page first for cookies
        session.get("https://www.nseindia.com/", headers=NSE_HEADERS, timeout=10)
        resp = session.get(
            NSE_ANNOUNCEMENTS_URL.format(symbol=clean_symbol),
            headers=NSE_HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data[:20]:
                filing = CorporateFiling(
                    stock_symbol=clean_symbol,
                    filing_type=item.get("desc", "General"),
                    subject=item.get("attchmntText", ""),
                    filing_date=datetime.strptime(item["an_dt"], "%d-%b-%Y").date()
                    if item.get("an_dt") else None,
                    pdf_url=item.get("attchmntFile"),
                    source="NSE",
                )
                db.add(filing)
                filings.append({
                    "type": filing.filing_type,
                    "subject": filing.subject,
                    "date": str(filing.filing_date),
                })
            await db.commit()
    except Exception as e:
        logger.warning(f"NSE filing fetch failed for {clean_symbol}: {e}")

    return filings
