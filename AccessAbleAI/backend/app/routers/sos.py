import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException
from app.database import get_db_connection
from app.models import SOSCreate, SOSResponse

router = APIRouter(prefix="/sos", tags=["sos"])

VALID_STATUSES = {"PREPARED", "SAVED", "SHARED", "DELIVERED"}

@router.get("", response_model=List[SOSResponse])
def get_sos_records():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sos_records ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("", response_model=SOSResponse, status_code=201)
def create_sos_record(payload: SOSCreate):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'. Valid statuses: {VALID_STATUSES}")
    
    if payload.status == "DELIVERED":
        raise HTTPException(
            status_code=400,
            detail="DELIVERED status is not allowed without a verified carrier receipt integration."
        )

    record_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sos_records (id, message, latitude, longitude, location_text, contact_name, contact_phone, status, share_method, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record_id,
        payload.message.strip(),
        payload.latitude,
        payload.longitude,
        payload.location_text.strip() if payload.location_text else None,
        payload.contact_name.strip(),
        payload.contact_phone.strip(),
        payload.status,
        payload.share_method.strip() if payload.share_method else None,
        now_utc
    ))
    conn.commit()
    cursor.execute("SELECT * FROM sos_records WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)
