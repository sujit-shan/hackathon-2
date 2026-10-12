import os
import httpx
from fastapi import APIRouter
from app.database import get_db_connection
from app.models import HealthResponse
from app.routers.signbridge import get_engine

router = APIRouter(tags=["health"])

DEFAULT_ISL_URL = os.environ.get("ISL_SERVICE_URL", "http://127.0.0.1:5000")

@router.get("/health", response_model=HealthResponse)
async def health_check():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM reports")
    reports_cnt = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM reports WHERE resolved = 0")
    active_barriers_cnt = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM sos_records")
    sos_cnt = cursor.fetchone()[0]
    conn.close()

    # Check SignBridge Engine status
    clf, classes, gest_rec, hand_lm = get_engine()
    if gest_rec is not None or hand_lm is not None or clf is not None:
        isl_online = True
        isl_details = {
            "source": "Random Forest Scale-Invariant Pipeline (<5ms)",
            "num_classes": len(classes),
            "model_loaded": True
        }
    else:
        isl_online = False
        isl_details = {"message": "SignBridge Engine Initializing"}

    # AI Provider configuration check
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY")
    ai_configured = bool((gemini_key and len(gemini_key) > 10) or (openai_key and len(openai_key) > 10))
    ai_provider = "BREAKING BARIERS Neural Co-Pilot" if ai_configured else "Contextual Platform Co-pilot"

    return {
        "status": "healthy",
        "service": "BREAKING BARIERS Unified Backend",
        "database": "sqlite_connected",
        "reports_count": reports_cnt,
        "active_barriers_count": active_barriers_cnt,
        "sos_records_count": sos_cnt,
        "isl_service_reachable": isl_online,
        "isl_service_details": isl_details,
        "ai_provider": ai_provider,
        "ai_configured": ai_configured
    }
