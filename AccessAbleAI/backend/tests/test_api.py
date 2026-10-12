import os
import tempfile
import pytest
from fastapi.testclient import TestClient

tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
tmp_db_path = tmp_db.name
tmp_db.close()
os.environ["ACCESSABLE_DB_PATH"] = tmp_db_path

from app.main import app
from app.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    yield
    if os.path.exists(tmp_db_path):
        try:
            os.remove(tmp_db_path)
        except Exception:
            pass

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "sqlite_connected"
    assert "reports_count" in data
    assert "active_barriers_count" in data
    assert "isl_service_reachable" in data
    assert "ai_provider" in data

def test_reports_seeded_or_retrieved():
    res = client.get("/reports")
    assert res.status_code == 200
    reports = res.json()
    assert isinstance(reports, list)
    assert len(reports) >= 5

def test_create_barrier_report():
    new_report = {
        "category": "road_construction",
        "title": "Pedestrian Path Digging at North Gate",
        "description": "Deep trench without ramp crossing. Impassable for wheelchairs and white cane users.",
        "latitude": 28.6142,
        "longitude": 77.2105,
        "location_name": "North Gate Crossing",
        "severity": "high",
        "affected_groups": "wheelchair",
        "alternative_route_note": "Detour via South Gate pedestrian overbridge"
    }
    res = client.post("/reports", json=new_report)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Pedestrian Path Digging at North Gate"
    assert data["category"] == "road_construction"
    assert data["severity"] == "high"
    assert data["confirmations_count"] == 0
    assert data["resolved"] == 0
    return data["id"]

def test_nearby_barrier_reports():
    res = client.get("/reports/nearby?latitude=28.6145&longitude=77.2100&radius_km=3.0")
    assert res.status_code == 200
    nearby = res.json()
    assert isinstance(nearby, list)
    assert len(nearby) >= 1
    assert "distance_km" in nearby[0]

def test_confirm_and_resolve_barrier():
    # 1. Create a barrier
    new_report = {
        "category": "broken_lift",
        "title": "Platform 3 Lift Broken",
        "description": "Broken lift cable. Technician notified.",
        "latitude": 28.6145,
        "longitude": 77.2098,
        "location_name": "Platform 3",
        "severity": "high",
        "affected_groups": "all"
    }
    r = client.post("/reports", json=new_report)
    report_id = r.json()["id"]

    # 2. Confirm barrier
    conf_res = client.post(f"/reports/{report_id}/confirm")
    assert conf_res.status_code == 200
    assert conf_res.json()["confirmations_count"] == 1
    assert "Confirmed by community" in conf_res.json()["status"]

    # 3. Resolve barrier
    res_res = client.post(f"/reports/{report_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["resolved"] == 1
    assert res_res.json()["status"] == "Resolved"

def test_sos_records_workflow():
    sos_payload = {
        "message": "Urgent wheelchair battery depleted near metro exit.",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_text": "Central Metro Gate 2",
        "contact_name": "Emergency Support Contact",
        "contact_phone": "+91-9876543210",
        "status": "SAVED",
        "share_method": "clipboard_copy"
    }
    res = client.post("/sos", json=sos_payload)
    assert res.status_code == 201
    assert res.json()["status"] == "SAVED"

    # Verify DELIVERED rejection
    delivered_payload = dict(sos_payload)
    delivered_payload["status"] = "DELIVERED"
    res_deliv = client.post("/sos", json=delivered_payload)
    assert res_deliv.status_code == 400

def test_signbridge_status():
    res = client.get("/signbridge/status")
    assert res.status_code == 200
    data = res.json()
    assert "online" in data
    assert data["online"] is True  # In-process PyTorch model is ready

def test_ai_chat_endpoint():
    req = {
        "messages": [
            {"role": "user", "content": "How do I report a barrier?"}
        ],
        "context": {"current_page": "dashboard"}
    }
    res = client.post("/ai/chat", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert "Community Barrier Reporting" in data["reply"]
    assert data["tool_action"]["page"] == "accessroute"
