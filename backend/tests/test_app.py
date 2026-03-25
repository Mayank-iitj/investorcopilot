from pathlib import Path
import sys

from fastapi.testclient import TestClient

# Ensure `app` is importable in local and CI runners regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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
