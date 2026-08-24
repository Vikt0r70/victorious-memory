"""Victorious Memory — FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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
    # Seed default agent roles before worker starts
    from app.database import async_session
    from app.domains.providers.service import seed_default_agents
    async with async_session() as session:
        await seed_default_agents(session)
        await session.commit()
    logger.info("Database ready. Starting extraction worker...")
    worker_task = asyncio.create_task(extraction_worker())

    # Warm the embedding model in the background so the first search isn't slow
    async def _warm_model() -> None:
        try:
            from app.domains.search.embeddings import embed_text
            await embed_text("warmup")
            logger.info("Embedding model warmed up.")
        except Exception as e:
            logger.warning("Embedding warmup failed (will lazy-load on demand): %s", e)

    asyncio.create_task(_warm_model())
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


# --- Access control (no-op when unconfigured, e.g. local dev) ---
# A request passes if its client IP is trusted OR it carries the right X-API-Key.
# Behind Cloudflare Tunnel the real client IP arrives in CF-Connecting-IP /
# X-Forwarded-For; direct LAN clients fall back to the socket address.
_TRUSTED_IPS = {ip.strip() for ip in settings.memory_trusted_ips.split(",") if ip.strip()}


@app.middleware("http")
async def access_control(request, call_next):
    path = request.url.path
    if not settings.memory_api_key and not _TRUSTED_IPS:
        return await call_next(request)
    if path == "/health":
        return await call_next(request)

    client_ip = (
        request.headers.get("cf-connecting-ip")
        or (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or None)
        or (request.client.host if request.client else "")
    )

    if client_ip and client_ip in _TRUSTED_IPS:
        return await call_next(request)
    if settings.memory_api_key and request.headers.get("x-api-key") == settings.memory_api_key:
        return await call_next(request)

    logger.warning("Rejected request to %s from untrusted source %s", path, client_ip or "unknown")
    from fastapi.responses import JSONResponse
    return JSONResponse({"detail": "Unauthorized"}, status_code=403)

# --- Mount all routers ---
from app.domains.ingest.router import router as ingest_router
from app.domains.context.router import router as context_router
from app.domains.memories.router import router as memories_router
from app.domains.projects.router import router as projects_router
from app.domains.providers.router import router as providers_router
from app.domains.providers.router import agents_router
from app.domains.providers.router import usage_router
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
app.include_router(agents_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(activity_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(exchanges_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(system_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
