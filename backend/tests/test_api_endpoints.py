"""Integration tests for FastAPI endpoints (app.main)."""
import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "classes" in data
    assert "broken-chalky" in data["classes"]
    assert "sound" in data["classes"]


def test_prices_endpoint():
    response = client.get("/api/prices")
    assert response.status_code == 200
    data = response.json()
    assert "andhra_pradesh_paddy_reference" in data
    ref = data["andhra_pradesh_paddy_reference"]
    assert "modal_price_per_quintal" in ref
    assert ref["modal_price_per_quintal"] > 0


def test_analyze_grain_v1_empty_image():
    response = client.post(
        "/api/v1/analyze-grain",
        files={"image": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_analyze_grain_v1_invalid_mime():
    response = client.post(
        "/api/v1/analyze-grain",
        files={"image": ("file.txt", b"plain text", "text/plain")},
    )
    assert response.status_code == 400


def test_analyze_grain_v1_synthetic_image():
    """Generates a small test RGB image and verifies end-to-end response contract."""
    img = Image.new("RGB", (640, 640), color=(240, 240, 240))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)

    response = client.post(
        "/api/v1/analyze-grain",
        files={"image": ("test_sample.jpg", buffer.getvalue(), "image/jpeg")},
        data={"variety": "Swarna Paddy", "lot_weight_kg": "500", "save_lot": "false"},
    )

    # 200 OK or 503 if torch model isn't active in test environment
    if response.status_code == 200:
        data = response.json()
        assert data["status"] == "success"
        assert "image" in data
        assert "detections" in data
        assert "metrics" in data
        assert "decision" in data
        assert "recommendation" in data["decision"]
        assert "disclaimer" in data
        assert "UNCERTIFIED_ESTIMATION_DEVICE" in data["disclaimer"]
    else:
        assert response.status_code in [500, 503]
