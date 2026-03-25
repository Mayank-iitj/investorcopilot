"""Alert System — WebSocket manager for real-time signal broadcasting."""
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections for real-time alerts."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)

    async def send_signal_alert(self, signal: dict):
        """Format and broadcast a trading signal alert."""
        alert = {
            "type": "signal_alert",
            "data": {
                "stock": signal.get("stock", ""),
                "signal_type": signal.get("type", ""),
                "direction": signal.get("direction", ""),
                "rule": signal.get("rule", ""),
                "price": signal.get("price"),
                "message": f"{signal.get('stock', '')} {signal.get('direction', '')} signal — "
                           f"{signal.get('type', '')} — {signal.get('rule', '')}",
            },
        }
        await self.broadcast(alert)

    async def send_recommendation_alert(self, rec: dict):
        """Broadcast a recommendation."""
        alert = {
            "type": "recommendation_alert",
            "data": {
                "stock": rec.get("symbol", ""),
                "action": rec.get("action", ""),
                "confidence": rec.get("confidence", 0),
                "message": f"{rec.get('symbol', '')} — {rec.get('action', '')} "
                           f"(confidence: {rec.get('confidence', 0):.0%})",
            },
        }
        await self.broadcast(alert)


# Singleton
alert_manager = ConnectionManager()


# ──────────────────────────────────────────────────────────────
#  Telegram Bot (optional — needs TELEGRAM_BOT_TOKEN env var)
# ──────────────────────────────────────────────────────────────

async def send_telegram_alert(message: str, token: str = None, chat_id: str = None):
    """Send alert via Telegram bot. Requires token + chat_id in .env."""
    from app.config import settings
    token = token or settings.TELEGRAM_BOT_TOKEN
    chat_id = chat_id or settings.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        logger.debug("Telegram not configured — skipping")
        return

    import httpx
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")
