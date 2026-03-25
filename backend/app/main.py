"""AI Investor Copilot — FastAPI Application Entry Point"""
import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger import jsonlogger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import async_session, init_db
from app.services.rate_limit import limiter
from app.tasks.scheduler import run_realtime_scan_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB tables. Shutdown: cleanup."""
    scan_task = None

    if settings.AUTO_INIT_DB:
        await init_db()

    if settings.ENVIRONMENT.lower() == "production" and settings.AUTH_ENABLED:
        if settings.JWT_SECRET_KEY in {"", "change-me-in-production"}:
            raise RuntimeError("JWT_SECRET_KEY must be a non-default value in production")
        if not settings.ADMIN_PASSWORD_HASH:
            raise RuntimeError("ADMIN_PASSWORD_HASH must be configured when AUTH_ENABLED=true")

    if settings.REALTIME_SCAN_INTERVAL_SECONDS < 30:
        raise RuntimeError("REALTIME_SCAN_INTERVAL_SECONDS must be >= 30")

    if settings.REALTIME_SCAN_ENABLED:
        scan_task = asyncio.create_task(run_realtime_scan_loop())

    app.state.scan_task = scan_task

    yield

    if scan_task:
        scan_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scan_task


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

if settings.LOG_JSON:
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        handler.setFormatter(
            jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )

if settings.ENABLE_SENTRY and settings.SENTRY_DSN:
    try:
        import sentry_sdk  # type: ignore[import-not-found]

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.2,
            environment=settings.ENVIRONMENT,
        )
    except ImportError:
        logging.getLogger(__name__).warning("Sentry enabled but sentry-sdk is not installed")


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade AI platform for Indian stock markets (NSE/BSE). "
                "Real data, verifiable signals, backtested strategies.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_hosts = settings.trusted_hosts_list or ["*"]
if settings.ENVIRONMENT.lower() != "production" and "testserver" not in allowed_hosts:
    allowed_hosts = [*allowed_hosts, "testserver"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only enforce host validation in production with explicit TRUSTED_HOSTS
if settings.ENVIRONMENT.lower() == "production" and settings.TRUSTED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts,
    )

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(SlowAPIMiddleware)

if settings.ENABLE_METRICS:
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

# ── Register API routers ──────────────────────────────────────────────
from app.api import auth as auth_router  # noqa: E402
from app.api import backtest as backtest_router  # noqa: E402
from app.api import portfolio as portfolio_router  # noqa: E402
from app.api import recommendations as rec_router  # noqa: E402
from app.api import signals as signals_router  # noqa: E402
from app.api import websocket as ws_router  # noqa: E402

app.include_router(auth_router.router, prefix="/api", tags=["Auth"])
app.include_router(signals_router.router, prefix="/api", tags=["Signals"])
app.include_router(portfolio_router.router, prefix="/api", tags=["Portfolio"])
app.include_router(backtest_router.router, prefix="/api", tags=["Backtest"])
app.include_router(rec_router.router, prefix="/api", tags=["Recommendations"])
app.include_router(ws_router.router, prefix="/ws", tags=["WebSocket"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health():
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "up", "environment": settings.ENVIRONMENT}
    except Exception as exc:
        logging.getLogger(__name__).exception("Health check failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"status": "degraded", "database": "down", "environment": settings.ENVIRONMENT},
        ) from exc
