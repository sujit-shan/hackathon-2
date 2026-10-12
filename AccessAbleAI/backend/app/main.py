from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import health, reports, sos, signbridge, ai_chat, eyegaze

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="AccessAble AI API",
    description="Unified API backend for AccessAble AI accessibility platform",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(reports.router)
app.include_router(sos.router)
app.include_router(signbridge.router)
app.include_router(ai_chat.router)
app.include_router(eyegaze.router)

@app.get("/")
def root():
    return {
        "app": "AccessAble AI",
        "version": "1.1.0",
        "documentation": "/docs",
        "endpoints": [
            "/health",
            "/reports",
            "/reports/nearby",
            "/reports/{id}/confirm",
            "/reports/{id}/resolve",
            "/sos",
            "/signbridge/status",
            "/signbridge/predict",
            "/ai/chat"
        ]
    }
