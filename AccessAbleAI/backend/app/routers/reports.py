import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.database import get_db_connection, haversine_distance
from app.models import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_CATEGORIES = {
    # Accessible Assets
    "ramp", "lift", "accessible_toilet", "step_free", "parking",
    # Community Barriers
    "blocked_pathway", "road_construction", "broken_lift", "missing_ramp",
    "steps_barrier", "obstructed_tactile", "broken_pavement", "parked_vehicle",
    "narrow_passage", "flooding", "inaccessible_entrance", "other"
}

VALID_SEVERITIES = {"low", "moderate", "high"}
VALID_AFFECTED = {"wheelchair", "low_vision", "elderly", "all"}

@router.get("", response_model=List[ReportResponse])
def get_reports(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    include_resolved: bool = Query(True)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM reports WHERE 1=1"
    params = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if status:
        query += " AND status = ?"
        params.append(status)
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if not include_resolved:
        query += " AND resolved = 0"
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.get("/nearby", response_model=List[ReportResponse])
def get_nearby_reports(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(2.0, ge=0.1, le=50.0),
    only_active_barriers: bool = Query(True)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM reports"
    if only_active_barriers:
        query += " WHERE resolved = 0"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    nearby = []
    for r in rows:
        d = haversine_distance(latitude, longitude, r["latitude"], r["longitude"])
        if d <= radius_km:
            item = dict(r)
            item["distance_km"] = round(d, 3)
            nearby.append(item)

    # Sort nearest first
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby

@router.get("/{report_id}", response_model=ReportResponse)
def get_report_by_id(report_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return dict(row)

@router.post("", response_model=ReportResponse, status_code=201)
def create_report(payload: ReportCreate):
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{payload.category}'. Valid categories are: {', '.join(sorted(VALID_CATEGORIES))}"
        )

    severity = payload.severity.lower()
    if severity not in VALID_SEVERITIES:
        severity = "moderate"

    affected = payload.affected_groups.lower()
    if affected not in VALID_AFFECTED:
        affected = "all"

    report_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc).isoformat()
    status = "USER REPORTED / UNVERIFIED"
    source = "Community Submission"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reports (
            id, category, title, description, latitude, longitude, location_name,
            status, source, created_at, severity, affected_groups, confirmations_count,
            flags_count, resolved, alternative_route_note, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    """, (
        report_id,
        payload.category,
        payload.title.strip(),
        payload.description.strip(),
        payload.latitude,
        payload.longitude,
        payload.location_name.strip(),
        status,
        source,
        now_utc,
        severity,
        affected,
        payload.alternative_route_note.strip() if payload.alternative_route_note else None,
        payload.photo_url.strip() if payload.photo_url else None
    ))
    conn.commit()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

@router.post("/{report_id}/confirm", response_model=ReportResponse)
def confirm_report(report_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    new_count = row["confirmations_count"] + 1
    new_status = "Confirmed by community" if row["status"] != "VERIFIED" else "VERIFIED"

    cursor.execute("""
        UPDATE reports
        SET confirmations_count = ?, status = ?
        WHERE id = ?
    """, (new_count, new_status, report_id))
    conn.commit()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    updated_row = cursor.fetchone()
    conn.close()
    return dict(updated_row)

@router.post("/{report_id}/resolve", response_model=ReportResponse)
def resolve_report(report_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    cursor.execute("""
        UPDATE reports
        SET resolved = 1, status = 'Resolved'
        WHERE id = ?
    """, (report_id,))
    conn.commit()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    updated_row = cursor.fetchone()
    conn.close()
    return dict(updated_row)

@router.post("/{report_id}/flag", response_model=ReportResponse)
def flag_report(report_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    new_flags = row["flags_count"] + 1
    new_status = row["status"]
    if new_flags >= 3 and row["status"] != "VERIFIED":
        new_status = "Under review (Flagged)"

    cursor.execute("""
        UPDATE reports
        SET flags_count = ?, status = ?
        WHERE id = ?
    """, (new_flags, new_status, report_id))
    conn.commit()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    updated_row = cursor.fetchone()
    conn.close()
    return dict(updated_row)
