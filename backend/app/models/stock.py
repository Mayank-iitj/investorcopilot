"""ORM models for stocks and price data."""
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, BigInteger, func
from sqlalchemy.orm import relationship
from app.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)  # e.g. RELIANCE.NS
    name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)
    exchange = Column(String(10), default="NSE")  # NSE or BSE
    created_at = Column(DateTime, server_default=func.now())

    prices = relationship("StockPrice", foreign_keys="StockPrice.stock_id",
                          primaryjoin="Stock.id == StockPrice.stock_id")


class StockPrice(Base):
    __tablename__ = "stock_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False)
    source = Column(String(50), default="yfinance")
    created_at = Column(DateTime, server_default=func.now())


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String(30), nullable=True, index=True)
    headline = Column(String(500), nullable=False)
    source = Column(String(200), nullable=True)
    url = Column(String(1000), nullable=True)
    published_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, server_default=func.now())


class CorporateFiling(Base):
    __tablename__ = "corporate_filings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String(30), nullable=False, index=True)
    filing_type = Column(String(100), nullable=True)  # earnings, insider, board meeting
    subject = Column(String(1000), nullable=True)
    filing_date = Column(Date, nullable=True)
    pdf_url = Column(String(1000), nullable=True)
    source = Column(String(100), default="NSE")
    fetched_at = Column(DateTime, server_default=func.now())
