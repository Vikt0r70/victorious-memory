"""
Phase 1 End-to-End Test
Runs against the local Docker stack at http://localhost:8080
"""

import json
import os
import time
import urllib.error
import urllib.request

import pytest

BASE = "http://localhost:8080/api"


def req(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label, condition, detail=""):
    """Assert-based check for use inside pytest test functions."""
    if not condition:
        pytest.fail(f"{label} — FAILED. {detail}")


@pytest.mark.skipif(
    not os.environ.get("E2E_API_KEY"),
    reason="E2E_API_KEY not set — skipping Phase 1 E2E test",
)
def test_phase1_end_to_end():
    print("\n=== Victorious Memory — Phase 1 E2E Test ===\n")

    # Step 1: Configure LLM provider
    print("1. Configuring LLM provider...")
    status, resp = req(
        "PUT",
        "/providers/extraction",
        {
            "role": "extraction",
            "provider_type": "openai_compatible",
            "base_url": "https://opencode.ai/zen/go/v1",
            "model": "deepseek-v4-flash",
            "api_key": os.environ.get("E2E_API_KEY", ""),
            "max_tokens": 2000,
        },
    )
    check("Provider configured", status in (200, 201), str(resp))

    # Step 2: Detect project
    print("2. Detecting project...")
    status, resp = req(
        "POST",
        "/projects/detect",
        {"path": "/workspace/my-test-project", "name": "Test Project"},
    )
    check("Project detected", status in (200, 201), str(resp))
    project_id = resp.get("id", "")
    check("Project has ID", bool(project_id), f"id={project_id}")
    print(f"     Project ID: {project_id}")

    # Step 3: Ingest an exchange
    print("3. Ingesting conversation exchange...")
    status, resp = req(
        "POST",
        "/ingest",
        {
            "project_id": project_id,
            "session_id": "test-session-e2e-001",
            "exchange": {
                "user": "I've decided we should use PostgreSQL instead of SQLite for the database because we need vector search support with pgvector.",
                "agent_parts": [
                    {
                        "type": "text",
                        "content": "Excellent choice. PostgreSQL with the pgvector extension gives us native vector similarity search. I'll update the database configuration and migration files to switch from SQLite to PostgreSQL.",
                        "timestamp": "2026-05-24T12:00:00Z",
                    },
                    {
                        "type": "tool_call",
                        "tool": "write_to_file",
                        "content": "[write_to_file completed: database.py updated]",
                        "timestamp": "2026-05-24T12:00:05Z",
                    },
                ],
                "file_paths": ["/workspace/my-test-project/src/database.py"],
                "timestamp": "2026-05-24T12:00:00Z",
            },
        },
    )
    check("Exchange ingested", status in (200, 201), str(resp))
    exchange_id = resp.get("exchange_id", "")
    job_id = resp.get("job_id", "")
    check("Got exchange_id", bool(exchange_id))
    check("Got job_id", bool(job_id))
    check("Status is queued", resp.get("status") == "queued")
    print(f"     Exchange: {exchange_id}, Job: {job_id}")

    # Step 4: Wait for extraction worker
    print("4. Waiting for extraction worker (max 30s)...")
    memories_found = []
    for i in range(15):
        time.sleep(2)
        status, resp = req("GET", f"/memories?project_id={project_id}")
        if status == 200 and resp.get("total", 0) > 0:
            memories_found = resp.get("items", [])
            print(
                f"     Worker processed in ~{(i+1)*2}s — {resp['total']} memories extracted"
            )
            break
        if i == 14:
            print("     (Worker still processing — checking activity log...)")
            status2, activity = req("GET", "/activity?limit=10")
            for evt in activity.get("items", []):
                print(
                    f"     Activity: [{evt['event_type']}] {evt['description']}"
                )

    check(
        "At least 1 memory extracted",
        len(memories_found) > 0,
        f"got {len(memories_found)}",
    )

    if memories_found:
        m = memories_found[0]
        print(f"\n     First memory:")
        print(f"       Content: {m['content'][:100]}")
        print(f"       Type: {m['memory_type']}, Scope: {m['scope']}")
        print(f"       Confidence: {m['confidence_score']} ({m['confidence_label']})")
        print(f"       Status: {m['status']}")
        check("Has memory_type", bool(m.get("memory_type")))
        check("Has confidence", m.get("confidence_score", 0) >= 0.5)
        check("Has status", m.get("status") in ("active", "pending_review"))

    # Step 5: Context endpoint
    print("\n5. Testing context endpoint...")
    status, ctx = req(
        "GET", f"/context?project_id={project_id}&query=database&tokens=1500"
    )
    check("Context returned", status == 200, str(ctx)[:200])
    check("Block is non-empty", bool(ctx.get("block", "")))
    check("memories_used > 0", ctx.get("memories_used", 0) > 0)
    print(f"     memories_used: {ctx['memories_used']}")
    print(f"     Block preview: {ctx['block'][:200]}...")

    # Step 6: Activity log
    print("\n6. Checking activity log...")
    status, activity = req("GET", "/activity?limit=20")
    check("Activity returns OK", status == 200)
    event_types = [e["event_type"] for e in activity.get("items", [])]
    print(f"     Events: {set(event_types)}")
    check("Has extraction events", any("extraction" in t for t in event_types))
    check("Has memory_created event", "memory_created" in event_types)

    print("\n=== ALL TESTS PASSED ✅ ===\n")
