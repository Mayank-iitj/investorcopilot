"""ORM models for backtest results."""
from sqlalchemy import JSON, Column, Date, DateTime, Float, Integer, String, func

from app.database import Base


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_name = Column(String(50), nullable=False, index=True)
    stock_symbol = Column(String(30), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_trades = Column(Integer, nullable=False, default=0)
    winning_trades = Column(Integer, nullable=False, default=0)
    win_rate = Column(Float, nullable=False, default=0.0)
    avg_return_pct = Column(Float, nullable=False, default=0.0)
    max_drawdown_pct = Column(Float, nullable=False, default=0.0)
    sharpe_ratio = Column(Float, nullable=True)
    total_return_pct = Column(Float, nullable=True)
    trade_details = Column(JSON, nullable=True)  # list of individual trades
    created_at = Column(DateTime, server_default=func.now())
