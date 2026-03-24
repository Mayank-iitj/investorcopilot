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
            # Keep connection alive; wait for messages from client
            data = await websocket.receive_text()
            # Echo back as acknowledgment
            await websocket.send_json({"type": "ack", "message": data})
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)
