"""AI Investor Copilot — FastAPI Application Entry Point"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB tables. Shutdown: cleanup."""
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade AI platform for Indian stock markets (NSE/BSE). "
                "Real data, verifiable signals, backtested strategies.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ──────────────────────────────────────────────
from app.api import signals as signals_router      # noqa: E402
from app.api import portfolio as portfolio_router  # noqa: E402
from app.api import backtest as backtest_router    # noqa: E402
from app.api import recommendations as rec_router  # noqa: E402
from app.api import websocket as ws_router         # noqa: E402

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
    return {"status": "ok"}
