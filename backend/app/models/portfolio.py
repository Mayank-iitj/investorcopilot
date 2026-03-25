"""ORM models for portfolio and holdings."""
from sqlalchemy import Column, Date, DateTime, Float, Integer, String, func

from app.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, default="Default")
    user_id = Column(String(100), nullable=True, default="default_user")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, nullable=False, index=True)
    stock_symbol = Column(String(30), nullable=False)
    quantity = Column(Integer, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    buy_date = Column(Date, nullable=True)
    sector = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
