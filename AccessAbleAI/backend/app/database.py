import os
import sqlite3
import uuid
import math
from datetime import datetime, timezone

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "accessable.db")

def get_db_path():
    return os.environ.get("ACCESSABLE_DB_PATH", DEFAULT_DB_PATH)

def get_db_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            location_name TEXT NOT NULL,
            status TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'moderate',
            affected_groups TEXT NOT NULL DEFAULT 'all',
            confirmations_count INTEGER NOT NULL DEFAULT 0,
            flags_count INTEGER NOT NULL DEFAULT 0,
            resolved INTEGER NOT NULL DEFAULT 0,
            alternative_route_note TEXT,
            photo_url TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sos_records (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            location_text TEXT,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            status TEXT NOT NULL,
            share_method TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()

    # Migration check for new barrier reporting columns
    cursor.execute("PRAGMA table_info(reports)")
    columns = [row[1] for row in cursor.fetchall()]
    if "severity" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN severity TEXT NOT NULL DEFAULT 'moderate'")
    if "affected_groups" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN affected_groups TEXT NOT NULL DEFAULT 'all'")
    if "confirmations_count" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN confirmations_count INTEGER NOT NULL DEFAULT 0")
    if "flags_count" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN flags_count INTEGER NOT NULL DEFAULT 0")
    if "resolved" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0")
    if "alternative_route_note" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN alternative_route_note TEXT")
    if "photo_url" not in columns:
        cursor.execute("ALTER TABLE reports ADD COLUMN photo_url TEXT")
    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM reports")
    count = cursor.fetchone()[0]
    if count == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        demo_reports = [
            (
                str(uuid.uuid4()),
                "broken_lift",
                "East Terminal Elevator Out of Service",
                "Elevator is currently under maintenance. High barrier for wheelchair users. Use ramp at North entrance as alternative.",
                28.6162,
                77.2075,
                "Commercial Hub Plaza",
                "DEMO DATA",
                "Seeded Demonstration Record",
                now_iso,
                "high",
                "wheelchair",
                4,
                0,
                0,
                "Use north pedestrian ramp located 80m behind the plaza.",
                None
            ),
            (
                str(uuid.uuid4()),
                "blocked_pathway",
                "Sidewalk Construction Debris on Market Road",
                "Temporary construction gravel and barriers blocking sidewalk wheelchair and walker access near bus stand.",
                28.6151,
                77.2130,
                "Market Road Crossing",
                "DEMO DATA",
                "Seeded Demonstration Record",
                now_iso,
                "high",
                "all",
                6,
                0,
                0,
                "Cross to west footpath at signalized pedestrian crossing.",
                None
            ),
            (
                str(uuid.uuid4()),
                "ramp",
                "Metro Station West Gate Accessible Ramp",
                "Wide concrete ramp with non-slip coating and dual handrails. Step-free access to ticket counter.",
                28.6139,
                77.2090,
                "Central Metro Station",
                "DEMO DATA",
                "Seeded Demonstration Record",
                now_iso,
                "low",
                "wheelchair",
                12,
                0,
                0,
                "Direct step-free route into ticketing hall.",
                None
            ),
            (
                str(uuid.uuid4()),
                "lift",
                "Platform 1 Accessible Elevator",
                "Broad elevator with Braille tactile buttons and audible voice annunciator.",
                28.6145,
                77.2098,
                "Central Railway Station",
                "DEMO DATA",
                "Seeded Demonstration Record",
                now_iso,
                "low",
                "all",
                15,
                0,
                0,
                None,
                None
            ),
            (
                str(uuid.uuid4()),
                "accessible_toilet",
                "Ground Floor Barrier-Free Restroom",
                "Grab rails on both sides, outward swinging door, low sink, emergency pull cord present.",
                28.6128,
                77.2112,
                "Public Library Complex",
                "DEMO DATA",
                "Seeded Demonstration Record",
                now_iso,
                "low",
                "all",
                5,
                0,
                0,
                None,
                None
            ),
            (
                str(uuid.uuid4()),
                "steps_barrier",
                "Unexpected 3 Steps at Post Office Entry",
                "Steep 3-step entrance without wheelchair ramp. Portable ramp request buzzer available beside door.",
                28.6175,
                77.2085,
                "General Post Office Sub-branch",
                "USER REPORTED / UNVERIFIED",
                "Community Submission",
                now_iso,
                "moderate",
                "wheelchair",
                3,
                0,
                0,
                "Ring security buzzer for portable ramp deployment.",
                None
            )
        ]
        cursor.executemany("""
            INSERT INTO reports (
                id, category, title, description, latitude, longitude, location_name,
                status, source, created_at, severity, affected_groups, confirmations_count,
                flags_count, resolved, alternative_route_note, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, demo_reports)
        conn.commit()
    conn.close()

def haversine_distance(lat1, lon1, lat2, lon2):
    # Returns distance in kilometers
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c
