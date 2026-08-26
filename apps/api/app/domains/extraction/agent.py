"""LLM extraction agent — reads conversations and extracts structured memory candidates."""

from __future__ import annotations

import json
import logging

from app.domains.extraction.schemas import MemoryCandidate
from app.domains.providers.gateway import gateway
from app.models import Exchange, Memory, Project

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    pass


def _format_existing(memories: list[Memory], max_items: int = 15) -> str:
    if not memories:
        return "None yet."
    lines = []
    for m in memories[:max_items]:
        lines.append(f"- [{m.memory_type}] {m.content[:120]}")
    if len(memories) > max_items:
        lines.append(f"  ... and {len(memories) - max_items} more (omitted for brevity)")
    return "\n".join(lines)


def _format_agent_parts(parts: list[dict]) -> str:
    if not parts:
        return "(no agent response recorded)"
    lines = []
    for p in parts:
        ptype = p.get("type", "text")
        content = p.get("content", "")
        if ptype == "text":
            lines.append(f"[Agent text] {content[:3000]}")
        elif ptype == "thinking":
            lines.append(f"[Agent thinking] {content[:1500]}")
        elif ptype == "tool_call":
            tool = p.get("tool", "?")
            lines.append(f"[Tool: {tool}] {content[:500]}")
    return "\n\n".join(lines) if lines else "(empty)"


def _format_conversation(exchanges: list[Exchange]) -> str:
    """Format single or multi-turn batch exchanges chronologically."""
    if not exchanges:
        return "(empty conversation)"
    if len(exchanges) == 1:
        exc = exchanges[0]
        parts = _format_agent_parts(exc.agent_parts or [])
        return (
            f"Session: {exc.session_id}\n"
            f"Time: {exc.created_at}\n\n"
            f"User: {exc.user_content or '(empty)'}\n\n"
            f"Agent:\n{parts}"
        )

    sections = []
    for idx, exc in enumerate(exchanges, 1):
        parts = _format_agent_parts(exc.agent_parts or [])
        user_text = exc.user_content or "(empty)"
        sections.append(
            f"--- Turn {idx} (Session: {exc.session_id}, Time: {exc.created_at}) ---\n"
            f"User: {user_text}\n\n"
            f"Agent:\n{parts}"
        )
    return "\n\n".join(sections)


def _build_prompt(
    exchanges: list[Exchange],
    project: Project | None,
    existing_memories: list[Memory],
    existing_preferences: list[Memory],
) -> str:
    project_name = project.display_name if project else "unknown"
    project_path = project.workspace_path if project else "unknown"
    formatted_existing = _format_existing(existing_memories)
    formatted_prefs = _format_existing(existing_preferences)
    formatted_conversation = _format_conversation(exchanges)

    return f"""You are a memory extraction agent for "Victorious Memory". Read the conversation and extract DURABLE knowledge worth remembering for future conversations.

## What to Extract
- Decisions: explicit choices ("we will use PostgreSQL", "switching to TypeScript")
- Preferences: personal or team preferences ("I prefer dark mode", "short functions")
- Constraints: hard rules ("never commit API keys", "must support 1000 users")
- Bugfixes: bugs found and how they were fixed
- Lessons: insights and realizations ("caching reduces latency by 40%")
- Patterns: recurring practices ("always test before deploy")
- Architecture: system design ("three-layer API/service/data")
- Context: ongoing project state ("migrating to OAuth2")
- Research: investigation findings
- References: useful links, tools, resources

## What NOT to Extract
- Ephemeral tasks: "create a file", "run this command", "read that file"
- Actual code content: don't memorize code, only decisions ABOUT code
- Greetings, meta-conversation: "hello", "thanks", "let me think"
- Things already known (see below)
- Bare words, tag names, file paths, or feature names ("consolidation", "edge-detection", "src/app/main.py") — content MUST be a complete standalone statement of at least ~10 words explaining the durable knowledge

## Scope Rules
- "project": References project files, architecture, project-specific decisions
- "global": Personal preferences, general knowledge, cross-cutting concerns
- "cross-project": Patterns that apply to multiple projects

## Confidence Rules
- 0.9+: User explicitly stated it or confirmed by tool output
- 0.7-0.9: Strongly implied, clear intent
- 0.5-0.7: Inferred, may need verification
- Below 0.5: Too vague — do NOT extract

## Current Project
Name: {project_name}
Path: {project_path}

## Already Known (do NOT duplicate)
{formatted_existing}

## User Preferences (already captured)
{formatted_prefs}

## Conversation Sequence
{formatted_conversation}

## Output
Return a JSON array. Empty array [] if nothing worth remembering.
Each item:
{{
  "content": "Clear, concise, standalone memory text",
  "type": "decision|preference|constraint|bugfix|lesson|pattern|research|reference|architecture|context",
  "scope": "project|global|cross-project",
  "confidence_score": 0.5-1.0,
  "confidence_reasoning": "Why this confidence level",
  "tags": ["relevant", "tags"],
  "supersedes_content": null
}}"""


def _parse_response(text: str) -> list[dict]:
    """Parse LLM JSON response, handling common formatting issues."""
    text = text.strip()
    # Try direct parse
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # LLM wrapped in a key like {"memories": [...]}
            for val in data.values():
                if isinstance(val, list):
                    return val
        return []
    except json.JSONDecodeError:
        pass

    # Try to extract JSON array from markdown code blocks
    import re
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return []


async def extract_memories(
    exchanges: list[Exchange] | Exchange,
    project: Project | None,
    existing_memories: list[Memory],
    existing_preferences: list[Memory],
) -> list[MemoryCandidate]:
    """Call the LLM to extract memory candidates from single or multi-turn conversation batch."""
    exchange_list = [exchanges] if isinstance(exchanges, Exchange) else exchanges
    prompt = _build_prompt(exchange_list, project, existing_memories, existing_preferences)
    logger.info(
        "Extraction call: %d exchanges, prompt ~%d chars",
        len(exchange_list), len(prompt),
    )

    # First attempt
    try:
        response = await gateway.complete(
            messages=[{"role": "system", "content": prompt}],
            model_role="extraction",
            response_format="json",
        )
    except Exception as exc:
        raise ExtractionError(f"LLM call failed: {exc}") from exc

    raw = _parse_response(response)
    logger.info("Extraction parse: %d raw items from response (%d chars)", len(raw), len(response))

    # If empty, try once more with stricter instruction
    if not raw:
        logger.warning(
            "Extraction: unparseable or empty LLM response, retrying. Raw (%d chars): %.500s",
            len(response), response,
        )
        try:
            response = await gateway.complete(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "Return ONLY a JSON array. If nothing worth remembering, return []."},
                ],
                model_role="extraction",
                response_format="json",
            )
            raw = _parse_response(response)
            logger.info("Extraction retry parse: %d raw items from response (%d chars)", len(raw), len(response))
        except Exception as exc:
            logger.warning("Extraction retry failed: %s", exc)

    # Convert to MemoryCandidate objects.
    # Some models return an array of plain strings instead of objects — wrap those.
    candidates = []
    skipped = 0
    for item in raw:
        if isinstance(item, str):
            item = {"content": item}
        if not isinstance(item, dict):
            skipped += 1
            continue
        try:
            candidate = MemoryCandidate(
                content=item.get("content", ""),
                memory_type=item.get("type", "reference"),
                scope=item.get("scope", "global"),
                confidence_score=float(item.get("confidence_score", 0.7)),
                confidence_reasoning=item.get("confidence_reasoning", ""),
                tags=item.get("tags", []),
                supersedes_content=item.get("supersedes_content"),
            )
            if candidate.content and len(candidate.content) >= 10:
                candidates.append(candidate)
            else:
                skipped += 1
        except Exception as exc:
            skipped += 1
            logger.warning("Skipping malformed candidate: %s (item: %.200s)", exc, item)

    logger.info(
        "Extraction done: %d/%d items -> %d candidates (%d skipped)",
        len(candidates), max(len(raw), 1), len(candidates), skipped,
    )
    return candidates
