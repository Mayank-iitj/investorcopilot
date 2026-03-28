"""AI Investor Copilot — Configuration"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "AI Investor Copilot"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./copilot.db"
    ENABLE_DOCS: bool = True
    AUTO_INIT_DB: bool = True

    # Security / networking
    CORS_ORIGINS: str = "http://localhost:3000"
    TRUSTED_HOSTS: str = "localhost,127.0.0.1,testserver,*.onrender.com,*.vercel.app"

    # Authentication / authorization
    AUTH_ENABLED: bool = False
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD_HASH: str = ""

    # External I/O safeguards
    EXTERNAL_API_TIMEOUT_SECONDS: int = 15

    # Request rate limits
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_SENSITIVE: str = "20/minute"

    # Observability
    ENABLE_METRICS: bool = True
    ENABLE_SENTRY: bool = False
    SENTRY_DSN: str | None = None
    
    # Redis (optional)
    REDIS_URL: str | None = None
    
    # API Keys (optional)
    NEWS_API_KEY: str | None = None
    ALPHA_VANTAGE_KEY: str | None = None
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_CHAT_ID: str | None = None
    OPENROUTER_API_KEY: str | None = None
    
    # Signal defaults
    RSI_OVERBOUGHT: float = 70.0
    RSI_OVERSOLD: float = 30.0
    MA_SHORT: int = 50
    MA_LONG: int = 200
    BREAKOUT_WINDOW: int = 20
    VOLUME_SPIKE_THRESHOLD: float = 2.0
    
    # Backtest defaults
    DEFAULT_BACKTEST_YEARS: int = 2

    # Realtime scanning loop
    REALTIME_SCAN_ENABLED: bool = True
    REALTIME_SCAN_INTERVAL_SECONDS: int = 120
    REALTIME_SCAN_DAYS_BACK: int = 5
    
    # Default watchlist (NSE tickers)
    DEFAULT_WATCHLIST: str = "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,ICICIBANK.NS,HINDUNILVR.NS,ITC.NS,SBIN.NS,BHARTIARTL.NS,KOTAKBANK.NS,LT.NS,AXISBANK.NS,WIPRO.NS,BAJFINANCE.NS,MARUTI.NS,TATAMOTORS.NS,SUNPHARMA.NS,TITAN.NS,ULTRACEMCO.NS,NESTLEIND.NS"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.TRUSTED_HOSTS.split(",") if host.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
