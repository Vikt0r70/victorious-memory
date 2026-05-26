# Phase 1: Provider System & Architecture — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 15
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/app/models.py` (modify) | model | CRUD | `apps/api/app/models.py` §ProviderConfig | exact (same file) |
| `apps/api/app/domains/providers/router.py` (replace) | controller | request-response | `apps/api/app/domains/providers/router.py` (current) | exact |
| `apps/api/app/domains/providers/service.py` (new) | service | CRUD | `apps/api/app/domains/memories/service.py` | role-match |
| `apps/api/app/domains/providers/schemas.py` (replace) | schema | transform | `apps/api/app/domains/providers/schemas.py` (current) | exact |
| `apps/api/app/domains/providers/gateway.py` (replace) | service | request-response | `apps/api/app/domains/providers/gateway.py` (current) | exact |
| `apps/api/app/config.py` (modify) | config | static | `apps/api/app/config.py` | exact (same file) |
| `apps/api/app/main.py` (modify) | config | static | `apps/api/app/main.py` | exact (same file) |
| `apps/api/app/worker.py` (modify) | service | event-driven | `apps/api/app/worker.py` | exact (same file) |
| `apps/web/app/settings/page.tsx` (modify) | component | request-response | `apps/web/app/settings/page.tsx` | exact (same file) |
| `apps/web/lib/api.ts` (modify) | utility | request-response | `apps/web/lib/api.ts` | exact (same file) |
| `apps/web/components/modals/ProviderConfigModal.tsx` (modify) | component | request-response | `apps/web/components/modals/ProviderConfigModal.tsx` | exact (same file) |
| Alembic migration (new) | migration | batch | Existing Alembic revisions | role-match |

---

## Backend Patterns

### 1. Domain Module Structure

**Pattern:** Every domain follows a strict `router.py` + `service.py` + `schemas.py` triad.

**Example:** `apps/api/app/domains/memories/`
```
memories/
├── router.py    # FastAPI endpoints, HTTP concerns
├── service.py   # Business logic, DB operations
└── schemas.py   # Pydantic request/response models
```

**Apply to:** New/restructured `apps/api/app/domains/providers/` must follow same triad.
- `router.py` — Provider registry CRUD, agent settings, test endpoint
- `service.py` — Provider registry operations, fallback chain resolution
- `schemas.py` — `ProviderCreate`, `ProviderResponse`, `AgentSettings`, `UsageLogResponse`

---

### 2. Router Patterns

**Pattern:** Thin routers that delegate all logic to services. Use `APIRouter(prefix=..., tags=[...])`, `@router.get/post/put/delete` with `response_model=`, and `Depends(get_db)` for DB sessions.

**Example:** `apps/api/app/domains/memories/router.py` (lines 27-66)
```python
router = APIRouter(prefix="/memories", tags=["memories"])

@router.get("", response_model=MemoryListResponse)
async def list_all(
    project_id: str | None = None,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_memories(db, project_id=project_id, page=page, per_page=per_page)
    return MemoryListResponse(
        items=[MemoryResponse.model_validate(m) for m in items],
        total=total, page=page, per_page=per_page,
    )
```

**Apply to:** New provider router (`apps/api/app/domains/providers/router.py`)
- Use `APIRouter(prefix="/providers", tags=["providers"])`
- All endpoints must specify `response_model=`
- Use `db: AsyncSession = Depends(get_db)` parameter
- Return Pydantic models, never raw dicts (per D-26, D-28)

---

### 3. Service Patterns

**Pattern:** Async service functions accept `AsyncSession` as first param, return domain objects or `None`/`bool`. No HTTP concerns in services.

**Example:** `apps/api/app/domains/memories/service.py` (lines 96-157)
```python
async def get_memory(db: AsyncSession, memory_id: str) -> Memory | None:
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    return result.scalar_one_or_none()

async def delete_memory(db: AsyncSession, memory_id: str) -> bool:
    memory = await get_memory(db, memory_id)
    if not memory:
        return False
    await db.delete(memory)
    await db.flush()
    return True
```

**Apply to:** New `apps/api/app/domains/providers/service.py`
- `async def list_providers(db: AsyncSession) -> tuple[list[Provider], int]`
- `async def get_provider(db: AsyncSession, provider_id: str) -> Provider | None`
- `async def create_provider(db: AsyncSession, ...) -> Provider`
- `async def delete_provider(db: AsyncSession, provider_id: str) -> bool`
- `async def resolve_provider_chain(db: AsyncSession, agent_role: str) -> list[Provider]`

---

### 4. Database Session Patterns

**Pattern:** `get_db()` dependency auto-commits on success, rolls back on exception. Services call `await db.flush()` after mutations.

**Example:** `apps/api/app/database.py` (lines 15-23)
```python
async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

**Example:** `apps/api/app/domains/memories/service.py` (lines 91-93)
```python
db.add(memory)
await db.flush()
return memory
```

**Apply to:** All new service functions must:
- Accept `db: AsyncSession` parameter
- Call `await db.flush()` after `db.add()` or mutations
- Never call `await db.commit()` — let `get_db()` handle it
- Return `None` for not-found, `False` for failed operations

---

### 5. Error Handling Patterns

**Pattern:** Service returns `None` or `False` for not-found/failed operations. Router raises `HTTPException` with appropriate status codes.

**Example:** `apps/api/app/domains/memories/router.py` (lines 120-125)
```python
@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_one(memory_id: str, db: AsyncSession = Depends(get_db)):
    mem = await get_memory(db, memory_id)
    if not mem:
        raise HTTPException(404, "Memory not found")
    return mem
```

**Example:** `apps/api/app/domains/providers/router.py` (lines 98-114)
```python
@router.post("/{role}/test", response_model=ProviderTestResponse)
async def test_provider(role: str) -> ProviderTestResponse:
    try:
        reply = await gateway.complete(...)
        return ProviderTestResponse(status="ok", response=reply.strip())
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
```

**Apply to:** New provider router
- 404 for not-found provider/agent
- 401 for authentication errors (bad API key)
- 502 for connection/provider errors
- 504 for timeout errors
- Catch `ProviderError` → `HTTPException(502, ...)`
- Catch `ProviderTimeoutError` → `HTTPException(504, ...)`
- Catch `ProviderAuthenticationError` → `HTTPException(401, ...)`

---

### 6. Model Definition Patterns

**Pattern:** SQLAlchemy 2.0 style with `Mapped[]` type annotations, `mapped_column()`, static `new_id()` method, `__table_args__` for indexes. IDs use TEXT with prefix.

**Example:** `apps/api/app/models.py` (lines 86-164)
```python
class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # ...
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @staticmethod
    def new_id() -> str:
        return _generate_id("mem")

    __table_args__ = (
        Index("idx_memories_project", "project_id"),
        # ...
    )
```

**Apply to:** New `Provider`, `Agent`, `UsageLog` models in `models.py`
- Use `Mapped[str] = mapped_column(Text, primary_key=True)` for IDs
- Use `new_id()` static method with `_generate_id("prefix")`
- Use `server_default=func.now()` for timestamps
- Use `onupdate=func.now()` for `updated_at`
- Use `__table_args__` for indexes and unique constraints
- `UsageLog` can use `Integer` autoincrement (per decision D-14) since it's append-only audit data

---

### 7. Schema Patterns

**Pattern:** Pydantic `BaseModel` with `model_config = {"from_attributes": True}`. Separate request/response models. Response schemas exclude sensitive fields.

**Example:** `apps/api/app/domains/memories/schemas.py` (lines 1-66)
```python
from pydantic import BaseModel

class MemoryCreateRequest(BaseModel):
    content: str
    memory_type: str = "reference"
    # ...

class MemoryResponse(BaseModel):
    id: str
    content: str
    # ...
    model_config = {"from_attributes": True}
```

**Example:** `apps/api/app/domains/providers/schemas.py` (lines 21-32)
```python
class ProviderConfigResponse(BaseModel):
    """Public representation — **no api_key**"""
    id: str
    role: str
    provider_type: str
    base_url: str
    model: str
    max_tokens: int
    created_at: datetime
    model_config = {"from_attributes": True}
```

**Apply to:** New provider schemas
- `ProviderCreate` — input model with all fields including `api_key`
- `ProviderResponse` — output model WITHOUT `api_key` field
- `AgentSettings` — input/output for agent configuration
- `UsageLogResponse` — output model for usage log entries
- All response models: `model_config = {"from_attributes": True}`
- Use `Literal[...]` for provider type validation (per D-27)

---

### 8. Config Patterns

**Pattern:** Pydantic `BaseSettings` singleton with `env_file=".env"`. Module-level `settings = Settings()`.

**Example:** `apps/api/app/config.py` (lines 1-36)
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://..."
    llm_base_url: str = "http://localhost:7777/v1"
    # ...
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

**Apply to:** Add to `apps/api/app/config.py`
```python
provider_key_encryption_key: str = ""  # Fernet key for encrypting API keys
```
- Follow existing env var naming: lowercase with underscores
- Add to `.env.example` with documentation comment

---

### 9. Gateway / Service Singleton Pattern

**Pattern:** Module-level singleton instantiated at import time. `gateway = ProviderGateway()`.

**Example:** `apps/api/app/domains/providers/gateway.py` (lines 35-223)
```python
class ProviderGateway:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=30.0)

    async def complete(self, messages: list[dict[str, str]], *, model_role: str = "extraction", ...):
        # ...

# Module-level singleton
gateway = ProviderGateway()
```

**Apply to:** New `apps/api/app/domains/providers/gateway.py`
- Keep module-level `gateway = ProviderGateway()` pattern
- Constructor sets up LiteLLM client (or httpx as fallback)
- `complete()` method accepts same signature for backward compatibility
- Add `_resolve_config()` that queries new `Provider` + `Agent` tables
- Add fallback chain resolution: `for provider in chain: try...except`
- Keep existing exception hierarchy: `ProviderError`, `ProviderTimeoutError`, add `ProviderRateLimitError`, `ProviderAuthenticationError`

---

### 10. Logging Patterns

**Pattern:** Module-level `logger = logging.getLogger(__name__)`. Structured format in `main.py`.

**Example:** `apps/api/app/main.py` (lines 17-21)
```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
```

**Example:** `apps/api/app/domains/memories/service.py` (lines 15)
```python
logger = logging.getLogger(__name__)
```

**Apply to:** All new backend files
- Every module starts with `logger = logging.getLogger(__name__)`
- Use `logger.info()`, `logger.warning()`, `logger.error()` for operational events
- Usage logging goes to DB table, not just logs

---

### 11. Router Mounting Pattern

**Pattern:** Deferred imports in `main.py` after app creation. `app.include_router(router, prefix="/api")`.

**Example:** `apps/api/app/main.py` (lines 54-77)
```python
# --- Mount all routers ---
from app.domains.memories.router import router as memories_router
# ...
app.include_router(memories_router, prefix="/api")
```

**Apply to:** New provider router mounts same way. No changes to mounting pattern needed — same `prefix="/api"`.

---

### 12. Worker Integration Pattern

**Pattern:** Worker calls `gateway.complete(model_role="extraction")`. Exceptions caught and retried with exponential backoff.

**Example:** `apps/api/app/domains/extraction/agent.py` (lines 160-167)
```python
response = await gateway.complete(
    messages=[{"role": "system", "content": prompt}],
    model_role="extraction",
    response_format="json",
)
```

**Apply to:** No changes needed to agent.py — gateway API stays backward compatible
- `model_role="extraction"` still works
- Gateway internally resolves to new provider registry + fallback chain

---

## Frontend Patterns

### 1. API Client Pattern

**Pattern:** `request<T>()` wrapper around `fetch()`. Named export objects grouping related endpoints. Returns `Promise<T>`. Throws `Error(")` with status code.

**Example:** `apps/web/lib/api.ts` (lines 1-52)
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const memoriesApi = {
  list: (params?: Record<string, string>) => request<any>(`/memories?${new URLSearchParams(params)}`),
  // ...
};
```

**Apply to:** Update `apps/web/lib/api.ts`
```typescript
export const providersApi = {
  list: () => request<any>("/providers"),
  create: (data: any) => request<any>("/providers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/providers/${id}`, { method: "DELETE" }),
  test: (id: string) => request<any>(`/providers/${id}/test`, { method: "POST" }),
  listModels: (id: string) => request<any>(`/providers/${id}/models`),
};

export const agentsApi = {
  list: () => request<any>("/agents"),
  update: (role: string, data: any) => request<any>(`/agents/${role}`, { method: "PUT", body: JSON.stringify(data) }),
  test: (role: string) => request<any>(`/agents/${role}/test`, { method: "POST" }),
};

export const usageApi = {
  list: (params?: Record<string, string>) => request<any>(`/usage?${new URLSearchParams(params)}`),
};
```

---

### 2. Component Export Pattern

**Pattern:** `export default function ComponentName()` for page/components. `"use client"` directive for interactive components.

**Example:** `apps/web/app/settings/page.tsx` (lines 1-17)
```typescript
"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  // ...
}
```

**Apply to:** Modified `apps/web/app/settings/page.tsx`
- Keep `"use client"` directive
- Keep `export default function SettingsPage()` pattern
- State managed with `useState`/`useEffect`

---

### 3. Data Fetching Pattern

**Pattern:** `useEffect` with `Promise.all()` for parallel loading. Set loading state, catch errors, set state.

**Example:** `apps/web/app/settings/page.tsx` (lines 32-44)
```typescript
useEffect(() => {
  Promise.all([
    providersApi.list().catch(() => ({ items: [] })),
    settingsApi.list().catch(() => ({ items: [] })),
  ]).then(([p, s]) => {
    const provs = p.items || p || [];
    setProviders(Array.isArray(provs) ? provs : []);
    // ...
    setLoading(false);
  });
}, []);
```

**Apply to:** Settings page data fetching
- Fetch providers, agents, and usage logs in parallel
- Use `.catch(() => defaultValue)` for graceful degradation
- Normalize responses (`p.items || p || []`) since backend may return either format

---

### 4. Form State Pattern

**Pattern:** Controlled inputs with `useState` per field. Inline `onChange` handlers. Save on blur or explicit button.

**Example:** `apps/web/app/settings/page.tsx` (lines 46-57)
```typescript
const saveSetting = async (key: string, value: any) => {
  await settingsApi.set(key, value);
  setSettings((prev) => ({ ...prev, [key]: value }));
};

<input
  value={getSetting(f.key, f.default)}
  onChange={(e) => saveSetting(f.key, parseInt(e.target.value))}
/>
```

**Apply to:** Provider registry forms
- Use `useState` for form fields
- Immediate save on change for toggles/sliders
- Explicit "Save" button for provider creation/editing
- `getSetting()` helper handles backend's wrapped value format `{"value": X}`

---

### 5. Modal Pattern

**Pattern:** Fixed overlay with `bg-black/60`, click-outside-to-close, centered card with `max-w-lg`.

**Example:** `apps/web/components/modals/ProviderConfigModal.tsx` (lines 82-86)
```typescript
<div
  className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
  onClick={(e) => e.target === e.currentTarget && onClose()}
>
  <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-lg">
```

**Apply to:** Modify `ProviderConfigModal.tsx`
- Keep same modal wrapper pattern
- Keep same header/body/footer structure
- Add provider registry fields: name, type, base_url, model, api_key
- Add "Test Connection" button with spinner state

---

### 6. Styling Patterns

**Pattern:** Tailwind v4 with Material Design 3 dark palette. Custom colors via `tailwind.config.ts`. No `dark:` prefixes — site is always dark.

**Key colors:**
- Background: `bg-[#13131b]` (surface)
- Cards: `bg-[#1e293b]` (card)
- Inputs: `bg-[#0d0d15]` border `border-[#464554]`
- Primary accent: `text-[#c0c1ff]` `bg-[#c0c1ff]`
- Success: `text-[#4ade80]`
- Error: `text-[#ffb4ab]` `bg-[#93000a]`
- Muted text: `text-[#c7c4d7]` `text-[#908fa0]`

**Example:** `apps/web/app/settings/page.tsx` (lines 120-144)
```typescript
<div className="flex flex-col gap-4">
  <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Settings</h1>
  <div className="flex gap-2 border-b border-[#464554]">
    <button className={`px-3 py-2.5 text-[14px] font-medium ...`}>...</button>
  </div>
</div>
```

**Apply to:** All new/modified frontend components
- Use existing color tokens, don't introduce new arbitrary colors
- Use `rounded-sm` for inputs, `rounded-lg` for cards
- Use `text-[14px]` for body, `text-[13px]` for secondary, `text-[12px]` for captions
- Use `font-mono` for URLs, model names, IDs
- Use `material-symbols-outlined` for icons

---

### 7. Tab/Section Pattern

**Pattern:** Array of tab names + index state. Conditional rendering with `{tab === N && (...) }`.

**Example:** `apps/web/app/settings/page.tsx` (lines 8, 17-18, 129-144)
```typescript
const TABS = ["Providers", "Extraction", "Auto-Approve", "Lifecycle", "Plugin", "Data"];

const [tab, setTab] = useState(0);

<div className="flex gap-2 border-b border-[#464554]">
  {TABS.map((t, i) => (
    <button
      key={t}
      onClick={() => setTab(i)}
      className={`... ${tab === i ? "border-[#c0c1ff] text-[#c0c1ff]" : "border-transparent text-[#c7c4d7]"}`}
    >
      {t}
    </button>
  ))}
</div>

{tab === 0 && (<div>...</div>)}
```

**Apply to:** Restructure settings page tabs
- New tab order: "Provider Registry", "Agent Routing", "Extraction", "Auto-Approve", "Lifecycle", "Plugin", "Data"
- Or: Keep existing tabs but replace "Providers" tab content with new registry + routing sections

---

### 8. Toggle Switch Pattern

**Pattern:** Custom toggle using checkbox + peer-checked Tailwind classes.

**Example:** `apps/web/app/settings/page.tsx` (lines 583-594)
```typescript
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="w-12 h-6 bg-[#464554] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full ... peer-checked:bg-[#4ade80]" />
    </label>
  );
}
```

**Apply to:** Reuse existing `Toggle` component. No need to recreate.

---

## Shared Patterns (Cross-Cutting)

### Authentication / Security

**Pattern:** No auth middleware. API is open. CORS allows all origins. Security via localhost/network isolation.

**Source:** `apps/api/app/main.py` (lines 46-52)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Apply to:** No auth changes for Phase 1. Provider API keys stored encrypted in DB.

### Encryption Pattern

**Pattern:** Fernet symmetric encryption for API keys at rest.

**New for Phase 1:**
```python
from cryptography.fernet import Fernet

# In config.py
provider_key_encryption_key: str = ""

# In service.py
_fernet = Fernet(settings.provider_key_encryption_key.encode())

def encrypt_key(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()

def decrypt_key(encrypted: str) -> str:
    return _fernet.decrypt(encrypted.encode()).decode()
```

### Activity Logging Pattern

**Pattern:** `log_activity()` helper inserts audit records.

**Example:** `apps/api/app/domains/activity.py`
```python
async def log_activity(db: AsyncSession, event_type: str, description: str, memory_id: str | None = None, project_id: str | None = None):
    # ...
```

**Apply to:** Usage logging is separate from activity logging. Usage logs go to new `usage_logs` table.

---

## Anti-Patterns to Avoid

### 1. Manual Dict Construction in Routers

**Current:** `apps/api/app/domains/projects/router.py` (lines 82-96) manually constructs dicts in timeline endpoint.
**Fix:** New provider router must use `response_model=` with Pydantic schemas everywhere (per D-26).

### 2. Mixed Response Formats

**Current:** Some endpoints return `{"items": [...], "total": N}`, others return raw lists.
**Fix:** Standardize all provider endpoints to use consistent `ItemsResponse[T]` pattern.

### 3. Inconsistent Error Codes

**Current:** Some routers use `HTTPException(404, "...")`, others use `HTTPException(status_code=404, detail="...")`.
**Fix:** Use keyword arguments consistently: `HTTPException(status_code=404, detail="...")`.

### 4. In-Process Embedding (Out of Scope)

**Note:** `sentence-transformers` running synchronously in async event loop is a known anti-pattern (per ARCHITECTURE.md), but fixing it belongs to Phase 6, not Phase 1.

### 5. Frontend API Types as `any`

**Current:** `request<any>` used throughout `apps/web/lib/api.ts`.
**Fix:** For Phase 1, keep `any` for consistency, but consider adding interfaces in future phase.

---

## Files with No Close Analog

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/app/domains/providers/encryption.py` | utility | transform | New encryption utility — pattern is straightforward but doesn't exist yet |
| `apps/api/alembic/versions/..._provider_registry.py` | migration | batch | New migration — follows Alembic patterns but is net-new |
| `.encryption_key` | config | static | New file for auto-generated Fernet key |

---

## Pattern Assignments Summary

### For Backend

| Pattern | Source File | Lines | Apply To |
|---------|-------------|-------|----------|
| Domain triad structure | `apps/api/app/domains/memories/` | all | `apps/api/app/domains/providers/` |
| Router thin delegation | `apps/api/app/domains/memories/router.py` | 27-66 | `apps/api/app/domains/providers/router.py` |
| Service CRUD pattern | `apps/api/app/domains/memories/service.py` | 96-157 | `apps/api/app/domains/providers/service.py` |
| DB session dependency | `apps/api/app/database.py` | 15-23 | All new router endpoints |
| Error handling | `apps/api/app/domains/memories/router.py` | 120-125 | `apps/api/app/domains/providers/router.py` |
| Model definition | `apps/api/app/models.py` | 86-164 | New `Provider`, `Agent`, `UsageLog` models |
| Schema patterns | `apps/api/app/domains/memories/schemas.py` | 1-66 | New provider schemas |
| Config singleton | `apps/api/app/config.py` | 1-36 | Add encryption key setting |
| Gateway singleton | `apps/api/app/domains/providers/gateway.py` | 35-223 | Rewrite with LiteLLM + fallback |
| Worker integration | `apps/api/app/domains/extraction/agent.py` | 160-167 | Keep same `gateway.complete()` API |

### For Frontend

| Pattern | Source File | Lines | Apply To |
|---------|-------------|-------|----------|
| API client wrapper | `apps/web/lib/api.ts` | 1-52 | Extend with provider/agent/usage endpoints |
| Component export | `apps/web/app/settings/page.tsx` | 1-17 | Modify settings page |
| Data fetching | `apps/web/app/settings/page.tsx` | 32-44 | Fetch providers + agents in parallel |
| Form state | `apps/web/app/settings/page.tsx` | 46-57 | Provider creation/editing forms |
| Modal overlay | `apps/web/components/modals/ProviderConfigModal.tsx` | 82-86 | Modify provider modal |
| Styling tokens | `apps/web/tailwind.config.ts` | 1-126 | Use existing MD3 dark palette |
| Tab sections | `apps/web/app/settings/page.tsx` | 129-144 | Restructure settings tabs |
| Toggle switch | `apps/web/app/settings/page.tsx` | 583-594 | Reuse existing component |

---

## Metadata

**Analog search scope:** `apps/api/app/`, `apps/web/app/`, `apps/web/components/`, `apps/web/lib/`
**Files scanned:** 15
**Pattern extraction date:** 2026-05-25
**Key conventions verified:**
- `snake_case` for Python modules, functions, variables
- `PascalCase` for Python classes
- `camelCase` for TypeScript functions, variables
- `PascalCase` for TypeScript components
- `from __future__ import annotations` in all Python files
- Python 3.12+ pipe syntax: `str | None` (not `Optional[str]`)
- Single blank lines between methods, double between top-level definitions
- Section separator comments: `# ─── Section Name ───`
