#!/usr/bin/env python3
"""
Victorious Memory MCP Server
Exposes 5 tools for manual memory interaction within OpenCode sessions.
"""

import json
import sys
import urllib.request
import urllib.error
import os
from typing import Any

API_BASE = os.environ.get("VICTORIOUS_API_URL", "http://localhost:8080")
API_KEY = os.environ.get("VICTORIOUS_API_KEY", "")


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
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


HANDLERS = {
    "search_memories": handle_search_memories,
    "get_context":     handle_get_context,
    "save_memory":     handle_save_memory,
    "list_memories":   handle_list_memories,
    "get_activity":    handle_get_activity,
}


# ── MCP Main loop ─────────────────────────────────────────────────────────────

def main():
    import urllib.parse  # needed in handler
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
                import urllib.parse
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
