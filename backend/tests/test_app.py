from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint() -> None:
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "running"


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code in (200, 503)


def test_strategies_endpoint() -> None:
    response = client.get("/api/signals/strategies")
    assert response.status_code == 200
    payload = response.json()
    assert "strategies" in payload
    assert len(payload["strategies"]) >= 5
