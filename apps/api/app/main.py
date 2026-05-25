"""Victorious Memory — FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.worker import extraction_worker

logger = logging.getLogger(__name__)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database ready. Starting extraction worker...")
    worker_task = asyncio.create_task(extraction_worker())
    logger.info("Victorious Memory API is ready.")
    yield
    # Shutdown
    worker_task.cancel()
    logger.info("Victorious Memory API shutting down.")


app = FastAPI(
    title="Victorious Memory",
    description="AI memory system that captures, structures, and retrieves knowledge from coding conversations.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Mount all routers ---
from app.domains.ingest.router import router as ingest_router
from app.domains.context.router import router as context_router
from app.domains.memories.router import router as memories_router
from app.domains.projects.router import router as projects_router
from app.domains.providers.router import router as providers_router
from app.domains.activity_router import router as activity_router
from app.domains.jobs_router import router as jobs_router
from app.domains.exchanges_router import router as exchanges_router
from app.domains.graph_router import router as graph_router
from app.domains.settings_router import router as settings_router
from app.domains.system_router import router as system_router

app.include_router(ingest_router, prefix="/api")
app.include_router(context_router, prefix="/api")
app.include_router(memories_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(providers_router, prefix="/api")
app.include_router(activity_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(exchanges_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(system_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
