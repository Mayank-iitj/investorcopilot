"""AI Investor Copilot — Configuration"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "AI Investor Copilot"
    DATABASE_URL: str = "sqlite+aiosqlite:///./copilot.db"
    
    # Redis (optional)
    REDIS_URL: Optional[str] = None
    
    # API Keys (optional)
    NEWS_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_KEY: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    # Signal defaults
    RSI_OVERBOUGHT: float = 70.0
    RSI_OVERSOLD: float = 30.0
    MA_SHORT: int = 50
    MA_LONG: int = 200
    BREAKOUT_WINDOW: int = 20
    VOLUME_SPIKE_THRESHOLD: float = 2.0
    
    # Backtest defaults
    DEFAULT_BACKTEST_YEARS: int = 2
    
    # Default watchlist (NSE tickers)
    DEFAULT_WATCHLIST: str = "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,ICICIBANK.NS,HINDUNILVR.NS,ITC.NS,SBIN.NS,BHARTIARTL.NS,KOTAKBANK.NS,LT.NS,AXISBANK.NS,WIPRO.NS,BAJFINANCE.NS,MARUTI.NS,TATAMOTORS.NS,SUNPHARMA.NS,TITAN.NS,ULTRACEMCO.NS,NESTLEIND.NS"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
