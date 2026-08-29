from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create pgvector extension and all tables."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column additions for backward-compatible migrations
        await conn.execute(
            text("ALTER TABLE exchanges ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ DEFAULT NULL")
        )
        await conn.execute(
            text("ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS exchange_ids TEXT[] DEFAULT '{}'")
        )
        await conn.execute(
            text("ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'extraction'")
        )
        # HNSW index for fast cosine similarity search (idempotent — only builds once)
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw "
                 "ON memories USING hnsw (embedding vector_cosine_ops) "
                 "WITH (m = 16, ef_construction = 64)")
        )
        # B1: pinned column — user-controlled always-on injection slot
        await conn.execute(
            text("ALTER TABLE memories ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false")
        )
        # B1: Full-Text Search — generated tsvector column + GIN index
        # Enables true dual-channel search (semantic + FTS in parallel, no gating)
        await conn.execute(
            text("ALTER TABLE memories ADD COLUMN IF NOT EXISTS "
                 "fts_vector tsvector GENERATED ALWAYS AS "
                 "(to_tsvector('english', content)) STORED")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_memories_fts ON memories USING gin(fts_vector)")
        )
