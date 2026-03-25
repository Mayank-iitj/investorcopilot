"""WebSocket endpoint for real-time alerts."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.alerts import alert_manager

router = APIRouter()


@router.websocket("/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket connection for real-time signal and recommendation alerts."""
    await alert_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "ack", "message": "received"})
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)
