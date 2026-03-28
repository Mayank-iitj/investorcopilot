import json
from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from app.config import settings

client = None
if settings.OPENROUTER_API_KEY:
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

SYSTEM_PROMPT = """You are an elite, highly sophisticated quantitative portfolio manager specializing in the Indian Stock Market (NSE/BSE).
Your sole purpose is to provide ultra-precise, data-driven financial insights to investors. You DO NOT provide generic definitions. You DO NOT hallucinate.

When responding to chat queries or analyzing a stock, you must strictly adhere to the following rules:
1. QUANTITATIVE FOCUS: Emphasize numbers, risk metrics (Beta, Sharpe), and technical indicators (RSI, MACD, Moving Averages).
2. TONE: Professional, authoritative, highly analytical, and concise. Speak like a hedge fund manager to a VIP client.
3. CONTEXT BOUNDARIES: Limit your advice based ONLY on the provided system context (signals, backtests, active portfolio). If you lack data, state "Insufficient quantitative data available for this assessment."
4. ACTIONABLE: Always conclude complex analyses with a clear, risk-weighted verdict (e.g., "STRONG BUY with a tight stop-loss below 50-EMA").

Never break character. Never generate long narrative introductions. Get straight to the alpha."""

async def generate_chat_response(messages: List[Dict[str, str]], context: str = "") -> AsyncGenerator[str, None]:
    if not client:
        yield "OpenRouter API block: Missing OPENROUTER_API_KEY environment variable. Please configure it to enable Copilot."
        return

    # Prepare strictly finetuned prompt array
    api_messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\nAvailable Live Context:\n" + context}
    ]
    for msg in messages:
        # Standardize roles
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        response = await client.chat.completions.create(
            model="meta-llama/llama-3.3-70b-instruct",
            messages=api_messages,
            stream=True,
            temperature=0.2, # Low temperature for analytical precision
            max_tokens=1024
        )
        
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        yield f"⚠️ API Error (OpenRouter): {str(e)}"

async def generate_stock_analysis(symbol: str, context_data: dict) -> str:
    if not client:
        return "OpenRouter API block: OPENROUTER_API_KEY is missing."

    analysis_context = f"""
    TARGET SYMBOL: {symbol}
    
    1. CURRENT SIGNALS & BACKTEST DATA:
    {json.dumps(context_data, indent=2)}
    
    TASK: Provide a rigorous 3-paragraph quantitative thesis on whether this stock should be bought, held, or sold. Do not use generic market jargon without backing it up with the provided stats.
    """

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": analysis_context}
    ]

    try:
        response = await client.chat.completions.create(
            model="meta-llama/llama-3.3-70b-instruct",
            messages=messages,
            stream=False,
            temperature=0.3,
            max_tokens=800
        )
        return response.choices[0].message.content or "No analysis could be generated."
    except Exception as e:
        return f"⚠️ API Error (OpenRouter): {str(e)}"
