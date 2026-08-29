#!/usr/bin/env python3
"""
Victorious Memory MCP Server
Exposes 11 tools for manual memory interaction within OpenCode sessions.
"""

import json
import sys
import urllib.request
import urllib.error
import urllib.parse
import os
from pathlib import Path
from typing import Any

# Resolve configuration: Config file > Environment variables > Fallback
CONFIG_FILE = Path.home() / ".victorious" / "config.json"
_file_cfg = {}
if CONFIG_FILE.exists():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            _file_cfg = json.load(f)
    except Exception:
        pass

API_BASE = _file_cfg.get("api_url") or os.environ.get("VICTORIOUS_API_URL", "https://memory.damra.co")
API_KEY = _file_cfg.get("api_key") or os.environ.get("VICTORIOUS_API_KEY", "")


def _headers() -> dict:
    h = {
        "Content-Type": "application/json",
        "User-Agent": "Victorious-MCP/1.0",
    }
    if API_KEY:
        h["X-API-Key"] = API_KEY
    return h


def api(path: str, method: str = "GET", body: dict | None = None, timeout: int = 30) -> dict | None:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data, method=method,
                headers=_headers(),
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}


# ── MCP Protocol ──────────────────────────────────────────────────────────────

def send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def send_error(id: Any, code: int, message: str) -> None:
    send({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}})


def send_result(id: Any, result: Any) -> None:
    send({"jsonrpc": "2.0", "id": id, "result": result})


# ── Tool definitions ──────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_memories",
        "description": "Search memories using hybrid semantic + keyword search. Returns the most relevant memories for the given query.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query":      {"type": "string",  "description": "Search query"},
                "project_id": {"type": "string",  "description": "Filter by project ID (optional)"},
                "top_k":      {"type": "integer", "description": "Number of results (default 10)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_context",
        "description": "Get the full memory context block for the current project and query. Returns the exact text that would be injected into the system prompt.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string",  "description": "Project ID to scope context"},
                "query":      {"type": "string",  "description": "Current user query for relevance scoring"},
                "tokens":     {"type": "integer", "description": "Max tokens for context block (default 1500)", "default": 1500},
            },
            "required": [],
        },
    },
    {
        "name": "save_memory",
        "description": "Manually save a memory. Use this to record important decisions, preferences, or facts that should be remembered.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content":      {"type": "string", "description": "The memory content"},
                "memory_type":  {"type": "string", "description": "Type: decision, preference, constraint, bugfix, lesson, pattern, research, reference, architecture, context", "default": "reference"},
                "scope":        {"type": "string", "description": "Scope: project, global, cross-project", "default": "global"},
                "project_id":   {"type": "string", "description": "Project ID (required for project scope)"},
                "confidence":   {"type": "number", "description": "Confidence 0-1 (default 0.9)", "default": 0.9},
                "tags":         {"type": "array",  "items": {"type": "string"}, "description": "Optional tags"},
            },
            "required": ["content"],
        },
    },
    {
        "name": "list_memories",
        "description": "List memories with optional filters. Useful for reviewing what the system knows.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id":       {"type": "string", "description": "Filter by project"},
                "scope":            {"type": "string", "description": "Filter by scope (project, global, cross-project)"},
                "memory_type":      {"type": "string", "description": "Filter by type"},
                "status":           {"type": "string", "description": "Filter by status (active, pending_review, rejected)", "default": "active"},
                "confidence_label": {"type": "string", "description": "Filter by confidence (high, medium, low)"},
                "limit":            {"type": "integer", "description": "Max results (default 20)", "default": 20},
            },
            "required": [],
        },
    },
    {
        "name": "get_activity",
        "description": "Get the recent activity log — shows what memories were extracted, approved, rejected, or failed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit":      {"type": "integer", "description": "Number of entries (default 20)", "default": 20},
                "event_type": {"type": "string",  "description": "Filter: extraction_started, memory_created, extraction_failed, extraction_completed, memory_approved, memory_rejected"},
                "project_id": {"type": "string",  "description": "Filter by project"},
            },
            "required": [],
        },
    },
    {
        "name": "approve_memory",
        "description": "Approve a memory that is in pending_review status. Moves it to active so it becomes available for injection and search.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string", "description": "The memory ID to approve"},
            },
            "required": ["memory_id"],
        },
    },
    {
        "name": "reject_memory",
        "description": "Reject a memory that is in pending_review status. Marks it as rejected so it is excluded from search and injection.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string", "description": "The memory ID to reject"},
            },
            "required": ["memory_id"],
        },
    },
    {
        "name": "get_stats",
        "description": "Get memory system statistics: total memories, by status, by type, by project. Useful for understanding the state of the memory store.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Filter by project (optional)"},
            },
            "required": [],
        },
    },
    {
        "name": "trigger_extraction",
        "description": "Trigger a batch extraction job for a project. This processes unextracted exchanges through the LLM extraction pipeline. Returns the job ID for tracking.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "The project ID to extract memories for"},
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "run_edge_detection",
        "description": "Run the edge detection pipeline to discover relationships between memories. Uses vector similarity to find candidate pairs, then an LLM classifies each pair as causes/enables/prevents/supports/contradicts/supersedes. Fills the knowledge graph.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Limit edge detection to a specific project (optional)"},
            },
            "required": [],
        },
    },
    {
        "name": "run_consolidation",
        "description": "Run the consolidation pipeline: merge near-duplicate memories, detect staleness, demote unused memories. Conservative — nothing is deleted, superseded memories are kept for audit. Improves memory quality over time.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Limit consolidation to a specific project (optional)"},
            },
            "required": [],
        },
    },
]


# ── Tool handlers ─────────────────────────────────────────────────────────────

def handle_search_memories(args: dict) -> str:
    payload = {
        "query":      args["query"],
        "project_id": args.get("project_id"),
        "top_k":      args.get("top_k", 10),
    }
    # 60s timeout: first call loads the sentence-transformers model (~10-20s)
    result = api("/api/memories/search", "POST", payload, timeout=60)
    if not result or "error" in result:
        return f"Error: {result}"
    items = result.get("items", [])
    if not items:
        return "No memories found for that query."
    lines = [f"Found {len(items)} memories:\n"]
    for i, item in enumerate(items, 1):
        m = item["memory"]
        score = item["score"]
        lines.append(f"{i}. [{m['memory_type']}] {m['content']}")
        lines.append(f"   Score: {score:.3f} | Confidence: {m['confidence_label']} ({m['confidence_score']:.2f}) | Scope: {m['scope']}")
        if m.get("tags"):
            lines.append(f"   Tags: {', '.join(m['tags'])}")
        lines.append("")
    return "\n".join(lines)


def handle_get_context(args: dict) -> str:
    params = []
    if args.get("project_id"): params.append(f"project_id={args['project_id']}")
    if args.get("query"):       params.append(f"query={urllib.parse.quote(args['query'])}")
    if args.get("tokens"):      params.append(f"tokens={args['tokens']}")
    qs = "?" + "&".join(params) if params else ""
    result = api(f"/api/context{qs}")
    if not result or "error" in result:
        return f"Error: {result}"
    if not result.get("block"):
        return "No memory context available yet. The system will build up context as you work."
    return f"Context block ({result['memories_used']} memories):\n\n{result['block']}"


def handle_save_memory(args: dict) -> str:
    payload = {
        "content":          args["content"],
        "memory_type":      args.get("memory_type", "reference"),
        "scope":            args.get("scope", "global"),
        "project_id":       args.get("project_id"),
        "confidence_score": args.get("confidence", 0.9),
        "tags":             args.get("tags", []),
        "source_type":      "user_statement",
    }
    result = api("/api/memories", "POST", payload)
    if not result or "error" in result:
        return f"Error saving memory: {result}"
    return (
        f"Memory saved ✅\n"
        f"ID:         {result['id']}\n"
        f"Type:       {result['memory_type']}\n"
        f"Scope:      {result['scope']}\n"
        f"Confidence: {result['confidence_label']} ({result['confidence_score']:.2f})\n"
        f"Status:     {result['status']}\n"
        f"Content:    {result['content']}"
    )


def handle_list_memories(args: dict) -> str:
    params = []
    if args.get("project_id"):       params.append(f"project_id={args['project_id']}")
    if args.get("scope"):            params.append(f"scope={args['scope']}")
    if args.get("memory_type"):      params.append(f"memory_type={args['memory_type']}")
    if args.get("status"):           params.append(f"status={args['status']}")
    if args.get("confidence_label"): params.append(f"confidence_label={args['confidence_label']}")
    limit = args.get("limit", 20)
    params.append(f"per_page={limit}")
    qs = "?" + "&".join(params) if params else ""
    result = api(f"/api/memories{qs}")
    if not result or "error" in result:
        return f"Error: {result}"
    items = result.get("items", [])
    total = result.get("total", 0)
    if not items:
        return "No memories found with those filters."
    lines = [f"Showing {len(items)} of {total} memories:\n"]
    for m in items:
        lines.append(f"• [{m['memory_type']}] {m['content'][:120]}")
        lines.append(f"  ID: {m['id']} | {m['confidence_label']} | {m['scope']} | {m['status']}")
        created = m.get("created_at", "")[:10]
        lines.append(f"  Created: {created}")
        lines.append("")
    return "\n".join(lines)


def handle_get_activity(args: dict) -> str:
    params = [f"limit={args.get('limit', 20)}"]
    if args.get("event_type"): params.append(f"event_type={args['event_type']}")
    if args.get("project_id"): params.append(f"project_id={args['project_id']}")
    qs = "?" + "&".join(params)
    result = api(f"/api/activity{qs}")
    if not result or "error" in result:
        return f"Error: {result}"
    items = result.get("items", [])
    if not items:
        return "No activity found."
    lines = [f"Recent activity ({len(items)} entries):\n"]
    for e in items:
        ts = e.get("created_at", "")[:19].replace("T", " ")
        lines.append(f"[{ts}] {e['event_type']}: {e['description']}")
    return "\n".join(lines)


def handle_approve_memory(args: dict) -> str:
    memory_id = args["memory_id"]
    result = api(f"/api/memories/{memory_id}/approve", "POST")
    if not result or "error" in result:
        return f"Error approving memory: {result}"
    return f"Memory approved ✅\nID: {result['id']}\nStatus: {result['status']}\nType: {result['memory_type']}"


def handle_reject_memory(args: dict) -> str:
    memory_id = args["memory_id"]
    result = api(f"/api/memories/{memory_id}/reject", "POST")
    if not result or "error" in result:
        return f"Error rejecting memory: {result}"
    return f"Memory rejected ❌\nID: {result['id']}\nStatus: {result['status']}"


def handle_get_stats(args: dict) -> str:
    path = "/api/memories/stats"
    if args.get("project_id"):
        path += f"?project_id={urllib.parse.quote(args['project_id'])}"
    result = api(path)
    if not result or "error" in result:
        return f"Error getting stats: {result}"
    lines = ["Memory Statistics:\n"]
    for key, val in sorted(result.items()):
        lines.append(f"  {key}: {val}")
    return "\n".join(lines)


def handle_trigger_extraction(args: dict) -> str:
    project_id = args["project_id"]
    result = api(f"/api/ingest/extract-now?project_id={urllib.parse.quote(project_id)}", "POST")
    if not result or "error" in result:
        return f"Error triggering extraction: {result}"
    return f"Extraction triggered ✅\nJob ID: {result.get('job_id', 'N/A')}\nExchanges queued: {result.get('exchanges_queued', 'N/A')}"


def handle_run_edge_detection(args: dict) -> str:
    path = "/api/edges/detect"
    if args.get("project_id"):
        path += f"?project_id={urllib.parse.quote(args['project_id'])}"
    result = api(path, "POST", timeout=120)
    if not result or "error" in result:
        return f"Error running edge detection: {result}"
    return f"Edge detection complete ✅\nEdges created: {result.get('edges_created', 0)}\nCandidates checked: {result.get('candidates', 0)}"


def handle_run_consolidation(args: dict) -> str:
    path = "/api/consolidation/run"
    if args.get("project_id"):
        path += f"?project_id={urllib.parse.quote(args['project_id'])}"
    result = api(path, "POST", timeout=120)
    if not result or "error" in result:
        return f"Error running consolidation: {result}"
    return f"Consolidation complete ✅\nMerged: {result.get('merged', 0)}\nStaleness-flagged: {result.get('stale_flagged', 0)}\nDemoted: {result.get('demoted', 0)}"


HANDLERS = {
    "search_memories":      handle_search_memories,
    "get_context":          handle_get_context,
    "save_memory":           handle_save_memory,
    "list_memories":        handle_list_memories,
    "get_activity":         handle_get_activity,
    "approve_memory":       handle_approve_memory,
    "reject_memory":        handle_reject_memory,
    "get_stats":            handle_get_stats,
    "trigger_extraction":   handle_trigger_extraction,
    "run_edge_detection":   handle_run_edge_detection,
    "run_consolidation":    handle_run_consolidation,
}


# ── MCP Main loop ─────────────────────────────────────────────────────────────

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = msg.get("method", "")
        msg_id = msg.get("id")
        params = msg.get("params", {})

        if method == "initialize":
            send_result(msg_id, {
                "protocolVersion": "2024-11-05",
                "capabilities":    {"tools": {}},
                "serverInfo":      {"name": "victorious-memory", "version": "1.0.0"},
            })

        elif method == "tools/list":
            send_result(msg_id, {"tools": TOOLS})

        elif method == "tools/call":
            tool_name = params.get("name")
            arguments  = params.get("arguments", {})
            handler = HANDLERS.get(tool_name)
            if not handler:
                send_error(msg_id, -32601, f"Unknown tool: {tool_name}")
                continue
            try:
                text = handler(arguments)
                send_result(msg_id, {
                    "content": [{"type": "text", "text": text}],
                    "isError": False,
                })
            except Exception as e:
                send_result(msg_id, {
                    "content": [{"type": "text", "text": f"Tool error: {e}"}],
                    "isError": True,
                })

        elif method == "notifications/initialized":
            pass  # No response needed

        else:
            if msg_id is not None:
                send_error(msg_id, -32601, f"Method not found: {method}")


if __name__ == "__main__":
    main()
