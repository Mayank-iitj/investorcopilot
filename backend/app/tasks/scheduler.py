"""Background task scheduler — can be extended with Celery/APScheduler."""
import asyncio
import logging
from app.config import settings

logger = logging.getLogger(__name__)


async def scheduled_scan():
    """Placeholder for scheduled signal scanning. Uses FastAPI BackgroundTasks in production."""
    watchlist = settings.DEFAULT_WATCHLIST.split(",")
    logger.info(f"Scheduled scan for {len(watchlist)} stocks")
    # In production: wire via APScheduler or Celery beat
    # For now, triggered via API endpoint POST /api/signals/scan
