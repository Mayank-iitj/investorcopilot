"""API Routes — AI Assistant"""
import json
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.services.decision import get_recommendation
from app.services.rate_limit import limiter
from app.services.llm_analysis import generate_stock_analysis, generate_chat_response

router = APIRouter()

class ChatRequest(BaseModel):
    messages: list[dict[str, str]]

@router.post("/chat")
@limiter.limit("20/minute")
async def copilot_chat(
    request: Request,
    body: ChatRequest,
):
    """
    Stream a chat response from the AI Copilot.
    """
    _ = request
    return StreamingResponse(
        generate_chat_response(body.messages),
        media_type="text/plain"
    )

@router.get("/analyze/{symbol}")
@limiter.limit("20/minute")
async def analyze_stock(
    request: Request,
    symbol: str,
    portfolio_id: int | None = Query(None, description="Portfolio ID for context"),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an AI insight summary specifically for the stock, powered by backtesting data.
    """
    _ = request
    # Step 1: Retrieve all signals, portfolio weights, and backtest results
    rec = await get_recommendation(db, symbol, portfolio_id=portfolio_id)
    
    # Step 2: Ask Groq LLM to elaborate on this raw data
    analysis = await generate_stock_analysis(symbol, rec)
    
    return {
        "symbol": symbol,
        "recommendation_summary": rec,
        "ai_analysis": analysis
    }
