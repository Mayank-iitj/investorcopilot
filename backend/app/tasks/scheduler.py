"""Background scheduler for periodic realtime scans using real market data."""
import asyncio
import logging

from app.config import settings
from app.database import async_session
from app.services.alerts import alert_manager
from app.services.data_ingestion import ingest_ohlcv
from app.services.signals import scan_stock

logger = logging.getLogger(__name__)


def get_watchlist() -> list[str]:
    return [s.strip() for s in settings.DEFAULT_WATCHLIST.split(",") if s.strip()]


async def run_single_scan_cycle() -> dict:
    """Run one full scan cycle for configured watchlist and broadcast alerts."""
    watchlist = get_watchlist()
    scanned = 0
    alerts_sent = 0

    for symbol in watchlist:
        try:
            async with async_session() as db:
                await ingest_ohlcv(db, symbol)
                signals = await scan_stock(db, symbol, days_back=settings.REALTIME_SCAN_DAYS_BACK)

            scanned += 1
            for sig in signals:
                await alert_manager.send_signal_alert(sig)
            alerts_sent += len(signals)
        except Exception:
            logger.exception("Scheduled scan failed for %s", symbol)

    return {"symbols_scanned": scanned, "alerts_sent": alerts_sent}


async def run_realtime_scan_loop() -> None:
    """Background loop for continuous scanning in production/local runtime."""
    interval = max(30, int(settings.REALTIME_SCAN_INTERVAL_SECONDS))
    logger.info("Realtime scan loop started interval=%ss", interval)

    while True:
        try:
            result = await run_single_scan_cycle()
            logger.info(
                "Realtime cycle complete: scanned=%s alerts=%s",
                result["symbols_scanned"],
                result["alerts_sent"],
            )
        except Exception:
            logger.exception("Realtime scan cycle crashed")

        await asyncio.sleep(interval)
