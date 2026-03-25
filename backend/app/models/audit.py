"""ORM models for audit logs."""
from sqlalchemy import JSON, Column, DateTime, Integer, String, func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action_type = Column(String(50), nullable=False, index=True)  # SIGNAL, RECOMMENDATION, BACKTEST, DATA_FETCH
    stock_symbol = Column(String(30), nullable=True, index=True)
    input_data = Column(JSON, nullable=True)
    rules_triggered = Column(JSON, nullable=True)
    logic_used = Column(String(500), nullable=True)
    output = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
