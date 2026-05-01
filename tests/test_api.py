import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


@pytest.fixture()
def api_module(monkeypatch):
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ENABLE_DEV_TOOLS", "true")
    if "backend.main" in sys.modules:
        del sys.modules["backend.main"]
    module = importlib.import_module("backend.main")
    importlib.reload(module)
    module.sensor_data_store.clear()
    module.alerts_store.clear()
    yield module
    module.sensor_data_store.clear()
    module.alerts_store.clear()


@pytest.fixture()
def client(api_module):
    with TestClient(api_module.app) as test_client:
        yield test_client


def test_zero_values_are_counted(client):
    payload = {
        "device_id": "sensor_zero",
        "timestamp": "2026-03-29T00:00:00+00:00",
        "sensors": {"temperature": 0, "humidity": 0, "gpio_1": 0},
    }
    response = client.post("/api/sensor/data", json=payload)
    assert response.status_code == 200

    stats = client.get("/api/stats")
    assert stats.status_code == 200
    data = stats.json()
    assert data["total_records"] == 1
    assert data["avg_temperature"] == 0.0
    assert data["avg_humidity"] == 0.0


def test_latest_uses_timestamp_not_insert_order(client):
    newer = {
        "device_id": "sensor_order",
        "timestamp": "2026-03-29T10:10:00+00:00",
        "sensors": {"temperature": 3.2, "humidity": 70.0},
    }
    older = {
        "device_id": "sensor_order",
        "timestamp": "2026-03-29T10:00:00+00:00",
        "sensors": {"temperature": 9.9, "humidity": 71.0},
    }
    assert client.post("/api/sensor/data", json=newer).status_code == 200
    assert client.post("/api/sensor/data", json=older).status_code == 200

    latest = client.get("/api/sensor/latest").json()
    assert latest["sensor_order"]["timestamp"] == newer["timestamp"]
    assert latest["sensor_order"]["sensors"]["temperature"] == newer["sensors"]["temperature"]


def test_alerts_include_metadata(client):
    payload = {
        "device_id": "sensor_hot",
        "timestamp": "2026-03-29T11:00:00+00:00",
        "sensors": {"temperature": 12.5, "humidity": 91.0},
    }
    assert client.post("/api/sensor/data", json=payload).status_code == 200

    alerts = client.get("/api/alerts?limit=10")
    assert alerts.status_code == 200
    data = alerts.json()
    assert len(data) == 2
    assert all(item["created_at"] for item in data)
    assert all(item["threshold"] for item in data)
    assert all(item["current_value"] for item in data)


def test_dashboard_response_shape(client):
    payload = {
        "device_id": "sensor_dash",
        "timestamp": "2026-03-29T12:00:00+00:00",
        "sensors": {"temperature": 4.2, "humidity": 75.0},
    }
    assert client.post("/api/sensor/data", json=payload).status_code == 200

    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "devices" in data
    assert "alerts" in data
    assert "trends" in data
    assert data["summary"]["online_devices"] == 1
    assert data["devices"][0]["device_id"] == "sensor_dash"
    assert data["trends"]["series"][0]["device_id"] == "sensor_dash"
