"""ORM models for trading signals."""
from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text, func

from app.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False, index=True)
    stock_symbol = Column(String(30), nullable=False, index=True)
    signal_type = Column(String(50), nullable=False, index=True)  # ma_crossover, rsi, macd, breakout, volume_spike
    direction = Column(String(10), nullable=False)  # BUY or SELL
    strength = Column(Float, nullable=True)  # 0.0 to 1.0
    rule_description = Column(Text, nullable=False)
    data_snapshot = Column(JSON, nullable=True)  # raw data at time of signal
    price_at_signal = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
