/**
 * Victorious Memory — OpenCode plugin
 *
 * Captures conversations and injects memory context into agent system prompts.
 *
 * Resilience contract: this plugin must NEVER block, crash, or disturb OpenCode.
 * - All network calls have hard timeouts (AbortController).
 * - Plugin init never awaits the network.
 * - Capture/ingest paths are fire-and-forget with internal error swallowing.
 * - Circuit breaker skips calls instantly while the backend is unhealthy.
 * - Failed ingests spill to an offline queue and replay on recovery.
 * - VICTORIOUS_DISABLED=1 turns everything off instantly.
 *
 * IMPORTANT: keep exactly ONE copy of this file loaded. Global plugins load from
 * ~/.config/opencode/plugins/ — do NOT also copy it into a project's
 * .opencode/plugins/, or it will run twice (duplicate ingestion + injection).
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// ── Configuration ─────────────────────────────────────────────────────────────

const API       = process.env.VICTORIOUS_API_URL || "http://localhost:8080"
const DEBUG     = process.env.VICTORIOUS_DEBUG === "1"
// File logging is always on by default — it is the primary evidence trail
const LOG_FILE  = process.env.VICTORIOUS_LOG_FILE || path.join(os.homedir(), ".victorious", "plugin.log")
const DISABLED  = process.env.VICTORIOUS_DISABLED === "1"

const num = (v, d) => { const n = parseInt(v || "", 10); return Number.isFinite(n) && n > 0 ? n : d }

// Minimum estimated tokens for an exchange to be worth extracting
const MIN_EXCHANGE_TOKENS = num(process.env.VICTORIOUS_MIN_TOKENS, 150)
// Accumulated token target before we prefer to flush (soft signal, not a gate)
const TOKEN_THRESHOLD = num(process.env.VICTORIOUS_TOKEN_THRESHOLD, 1500)
// Max tokens of memory context to inject into the system prompt
const INJECT_TOKENS   = num(process.env.VICTORIOUS_INJECT_TOKENS, 1500)
// Hard cap on buffered exchange size before an immediate flush fires
const MAX_EXCHANGE_TOKENS = num(process.env.VICTORIOUS_MAX_EXCHANGE_TOKENS, 20000)

// Network timeouts (ms) — hard ceilings so a dead/hung backend can never hang OpenCode
const TIMEOUT_API_MS     = num(process.env.VICTORIOUS_TIMEOUT_MS, 4000)
const TIMEOUT_CONTEXT_MS = num(process.env.VICTORIOUS_CONTEXT_TIMEOUT_MS, 3000)
const TIMEOUT_INGEST_MS  = num(process.env.VICTORIOUS_INGEST_TIMEOUT_MS, 8000)

// Circuit breaker
const FAILURE_THRESHOLD = 3
const COOLDOWN_MS       = num(process.env.VICTORIOUS_COOLDOWN_MS, 60000)

// Offline spill-over queue
const QUEUE_DIR  = process.env.VICTORIOUS_QUEUE_DIR || path.join(os.homedir(), ".victorious")
const QUEUE_FILE = path.join(QUEUE_DIR, "queue.jsonl")
const REPLAY_MAX = 20

// Trivial user messages that shouldn't trigger extraction
const TRIVIAL_PATTERNS = [
  /^(yes|no|ok|okay|sure|yep|nope|yea|yeah|nah|y|n)[\s!.?]*$/i,
  /^(thanks|thank you|thx|ty|cheers)[\s!.?]*$/i,
  /^(continue|keep going|go ahead|proceed|next|do it|go on|go)[\s!.?]*$/i,
  /^(hello|hi|hey|sup|yo|good morning|good evening)[\s!.?]*$/i,
  /^(looks good|lgtm|nice|great|perfect|awesome|cool|got it)[\s!.?]*$/i,
  /^(start working|start|begin|run it|ship it)[\s!.?]*$/i,
]

// ── Logging ───────────────────────────────────────────────────────────────────

const log = {
  _ts: () => new Date().toISOString(),
  _sid: () => sessionId || null,
  _write(line) {
    if (!LOG_FILE) return
    try { fs.appendFileSync(LOG_FILE, line + "\n") } catch {}
  },
  info(msg, data = {}) {
    const entry = { ts: this._ts(), level: "info", msg, session_id: this._sid(), ...data }
    if (DEBUG) console.log(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
  warn(msg, data = {}) {
    const entry = { ts: this._ts(), level: "warn", msg, session_id: this._sid(), ...data }
    console.warn(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
  error(msg, data = {}) {
    const entry = { ts: this._ts(), level: "error", msg, session_id: this._sid(), ...data }
    console.error(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

const health = { failures: 0, openUntil: 0 }

function circuitOpen() {
  return Date.now() < health.openUntil
}

function recordSuccess() {
  if (health.openUntil) log.info("Backend recovered — circuit closed, resuming memory capture")
  health.failures = 0
  health.openUntil = 0
}

function recordFailure(reason) {
  // Re-open = a probe failed after a full cooldown of continued unhealthiness.
  // That transition is the natural once-per-cooldown notice point.
  const reopening = health.failures >= FAILURE_THRESHOLD && !circuitOpen()
  health.failures += 1
  if (health.failures >= FAILURE_THRESHOLD && !circuitOpen()) {
    health.openUntil = Date.now() + COOLDOWN_MS
    if (reopening && health.failures > FAILURE_THRESHOLD) {
      log.warn("Memory still paused (backend unhealthy)", {
        failures: health.failures,
        queued: readQueue().length,
        resumes_at: new Date(health.openUntil).toISOString(),
      })
    } else {
      log.warn(`Backend unhealthy (${reason}) — memory paused for ${COOLDOWN_MS / 1000}s`, {
        failures: health.failures,
      })
    }
  }
}

// ── API helper ────────────────────────────────────────────────────────────────

async function api(path, method = "GET", body = null, timeoutMs = TIMEOUT_API_MS) {
  if (circuitOpen()) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const opts = { method, headers: { "Content-Type": "application/json" }, signal: controller.signal }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${API}${path}`, opts)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      if (res.status >= 500) recordFailure(`HTTP ${res.status}`)
      log.warn(`API ${method} ${path} -> ${res.status}`, { body: text.slice(0, 200) })
      return null
    }
    const json = await res.json()
    recordSuccess()
    return json
  } catch (e) {
    const aborted = e?.name === "AbortError"
    recordFailure(aborted ? "timeout" : "network error")
    // Only log the first failure in a streak to avoid console spam
    if (health.failures <= 1) {
      log.error(`API ${method} ${path} ${aborted ? `timed out after ${timeoutMs}ms` : "network error"}`, {
        error: e?.message,
        hint: "memory features degraded; they will resume automatically",
      })
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── Offline queue ─────────────────────────────────────────────────────────────

function enqueueOffline(payload) {
  try {
    fs.mkdirSync(QUEUE_DIR, { recursive: true })
    fs.appendFileSync(QUEUE_FILE, JSON.stringify({ queued_at: new Date().toISOString(), payload }) + "\n")
    log.info("Exchange queued offline", { queue: QUEUE_FILE })
  } catch {}
}

function readQueue() {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, "utf8").trim()
    if (!raw) return []
    return raw.split("\n").map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

function writeQueue(entries) {
  try {
    if (entries.length === 0) { fs.rmSync(QUEUE_FILE, { force: true }); return }
    fs.mkdirSync(QUEUE_DIR, { recursive: true })
    fs.writeFileSync(QUEUE_FILE, entries.map(e => JSON.stringify(e)).join("\n") + "\n")
  } catch {}
}

let replaying = false

async function replayQueue() {
  if (replaying) return
  replaying = true
  try {
    const entries = readQueue()
    if (entries.length === 0) return
    const batch = entries.slice(0, REPLAY_MAX)
    let sent = 0
    for (const entry of batch) {
      const result = await api("/api/ingest", "POST", entry.payload, TIMEOUT_INGEST_MS)
      if (!result) break
      sent += 1
    }
    if (sent > 0) {
      writeQueue(entries.slice(sent))
      log.info("Replayed offline exchanges", { sent, remaining: entries.length - sent })
    }
  } catch (e) {
    // Containment: queue replay must never surface an unhandled rejection
    log.error("replayQueue failed (contained)", { error: e?.message })
  } finally {
    replaying = false
  }
}

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4)
}

// ── Trivial message detection ─────────────────────────────────────────────────

function isTrivialMessage(text) {
  if (!text) return true
  const trimmed = text.trim()
  if (trimmed.length < 5) return true
  return TRIVIAL_PATTERNS.some(p => p.test(trimmed))
}

// ── Project detection from cwd ────────────────────────────────────────────────

function detectProjectFromCwd() {
  try {
    return process.cwd().replace(/\\/g, "/")
  } catch {
    return null
  }
}

async function ensureProject(pathArg) {
  if (!pathArg) return null
  const result = await api("/api/projects/detect", "POST", { path: pathArg }, TIMEOUT_API_MS)
  return result?.id || null
}

// ── State ─────────────────────────────────────────────────────────────────────

let sessionId     = null
let projectId     = null
let projectPath   = null

// Accumulate current exchange
let currentUser        = ""
let agentParts         = []   // [{type, content, tool, timestamp}]
let accumulatedTokens  = 0

// Track last user message for context query (survives across flushes)
let lastUserMessage = ""

// ── Ingest ────────────────────────────────────────────────────────────────────
// Snapshot-then-send: exchange state is captured and reset synchronously,
// so callers can detach this without racing on module state.

async function flushExchange(reason = "threshold") {
  try {
    if (!currentUser && agentParts.length === 0) return

    const userTokens  = estimateTokens(currentUser)
    const totalTokens = accumulatedTokens || userTokens

    // Quality gate: skip trivial exchanges
    if (isTrivialMessage(currentUser) && agentParts.length === 0) {
      log.info("Skipping trivial exchange (no agent response)", { user: currentUser.slice(0, 50) })
      currentUser = ""; agentParts = []; accumulatedTokens = 0
      return
    }

    // Quality gate: too small to contain extractable knowledge
    if (totalTokens < MIN_EXCHANGE_TOKENS) {
      log.info("Skipping small exchange", { tokens: totalTokens, min: MIN_EXCHANGE_TOKENS, reason })
      currentUser = ""; agentParts = []; accumulatedTokens = 0
      return
    }

    const payload = {
      project_id: projectId,
      session_id: sessionId || "opencode-default",
      exchange: {
        user:        currentUser,
        agent_parts: agentParts,
        file_paths:  [],
        timestamp:   new Date().toISOString(),
      },
    }

    // Preserve last meaningful user message for context query
    if (currentUser && !isTrivialMessage(currentUser)) lastUserMessage = currentUser

    // Reset buffer synchronously before any await
    currentUser = ""; agentParts = []; accumulatedTokens = 0

    const result = await api("/api/ingest", "POST", payload, TIMEOUT_INGEST_MS)
    if (result) {
      log.info("Exchange ingested", {
        reason,
        exchange_id:  result.exchange_id,
        job_id:       result.job_id || "(skipped)",
        user_tokens:  userTokens,
        parts:        payload.exchange.agent_parts.length,
        total_tokens: totalTokens,
        project_id:   projectId,
      })
      // Backend is back — drain anything that piled up while it was down
      void replayQueue()
    } else {
      enqueueOffline(payload)
    }
  } catch (e) {
    // Absolute containment: flushing must never throw into OpenCode
    log.error("flushExchange failed (contained)", { error: e?.message })
  }
}

// Flush immediately when the buffer grows past its hard cap (mid-turn safety)
function maybeCapFlush(reason) {
  if (accumulatedTokens < MAX_EXCHANGE_TOKENS) return
  log.info("Exchange buffer cap reached — flushing", { tokens: accumulatedTokens, cap: MAX_EXCHANGE_TOKENS })
  void flushExchange(reason)
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const VictoriousMemoryPlugin = async ({ client }) => {
  if (DISABLED) {
    log.info("Plugin disabled via VICTORIOUS_DISABLED")
    return {}
  }

  // Never await the network during plugin load — OpenCode blocks on plugin init.
  try {
    projectPath = detectProjectFromCwd()
    sessionId   = `opencode-${Date.now()}`
    void ensureProject(projectPath)
      .then(id => {
        projectId = id
        log.info("Plugin initialized", {
          api: API, projectPath, projectId, sessionId,
          tokenThreshold: TOKEN_THRESHOLD, minExchangeTokens: MIN_EXCHANGE_TOKENS,
          injectTokens: INJECT_TOKENS,
        })
      })
      .catch(() => {})
  } catch {}

  return {
    // ── 1. BEFORE LLM CALL: inject memory context into system prompt ──────
    "experimental.chat.system.transform": async (input, output) => {
      if (!output?.system) return
      try {
        const params = new URLSearchParams({ tokens: INJECT_TOKENS })
        if (projectId) params.set("project_id", projectId)

        const queryText = currentUser || lastUserMessage
        if (queryText && !isTrivialMessage(queryText)) {
          params.set("query", queryText.slice(0, 500))
        }

        const ctx = await api(`/api/context?${params}`, "GET", null, TIMEOUT_CONTEXT_MS)
        if (!ctx?.block) {
          log.info("No memory context available", { healthy: !!ctx, project_id: projectId })
          return
        }

        output.system.unshift(ctx.block)

        log.info("Memory injected", {
          memories_used: ctx.memories_used,
          project_id:    ctx.project_id,
          chars:         ctx.block.length,
        })
      } catch (e) {
        log.error("system.transform error (context skipped)", { error: e?.message })
      }
    },

    // ── 2. WHEN USER SENDS MESSAGE: extract text, start new exchange ──────
    "chat.message": async (input, output) => {
      try {
        const parts = output?.parts || []
        const userContent = parts
          .filter(p => p.type === "text")
          .map(p => p.text || "")
          .join("\n")
        if (!userContent) return

        // Flush previous exchange detached — never delay the user's message
        if (currentUser || agentParts.length > 0) void flushExchange("new_message")

        currentUser       = userContent
        accumulatedTokens = estimateTokens(userContent)

        log.info("New user message", {
          tokens: accumulatedTokens,
          trivial: isTrivialMessage(userContent),
          project_id: projectId,
        })
      } catch (e) {
        log.error("chat.message error (contained)", { error: e?.message })
      }
    },

    // ── 3. CAPTURE ASSISTANT TEXT RESPONSES ────────────────────────────────
    "experimental.text.complete": async (input, output) => {
      try {
        const textContent = output?.text
        if (!textContent || textContent.length < 10) return

        agentParts.push({
          type:      "text",
          content:   textContent.slice(0, 8000),
          timestamp: new Date().toISOString(),
        })
        accumulatedTokens += estimateTokens(textContent)

        log.info("Assistant response captured", {
          tokens: estimateTokens(textContent),
          total:  accumulatedTokens,
        })
        maybeCapFlush("text_cap")
      } catch (e) {
        log.error("text.complete error (contained)", { error: e?.message })
      }
    },

    // ── 4. AFTER TOOL EXECUTION: capture tool results ──────────────────────
    "tool.execute.after": async (input, output) => {
      try {
        const toolName = input?.tool || "unknown"
        const result   = output?.output

        if (result && typeof result === "string" && result.length > 5) {
          agentParts.push({
            type:      "tool_call",
            tool:      toolName,
            content:   result.slice(0, 4000),
            timestamp: new Date().toISOString(),
          })
          accumulatedTokens += estimateTokens(result)

          if (accumulatedTokens >= TOKEN_THRESHOLD) {
            log.info("Token threshold reached — will flush on next boundary", { tokens: accumulatedTokens })
          }
          maybeCapFlush("tool_cap")
        }
      } catch (e) {
        log.error("tool.execute.after error (contained)", { error: e?.message })
      }
    },

    // ── 5. SESSION CREATED: detect project from new working dir ──────────
    "session.created": async () => {
      try {
        if (currentUser || agentParts.length > 0) void flushExchange("session_end")

        const newPath = detectProjectFromCwd()
        if (newPath !== projectPath || !projectId) {
          projectPath = newPath
          void ensureProject(newPath)
            .then(id => {
              projectId = id
              log.info("Project detected", { projectPath, projectId })
            })
            .catch(() => {})
        }

        sessionId = `opencode-${Date.now()}`
        log.info("Session created", { sessionId, projectId })
      } catch (e) {
        log.error("session.created error (contained)", { error: e?.message })
      }
    },

    // ── 6. SESSION IDLE: flush any remaining exchange ─────────────────────
    "session.idle": async () => {
      try {
        if (currentUser || agentParts.length > 0) {
          log.info("Session idle — flushing exchange", { tokens: accumulatedTokens })
          void flushExchange("session_idle")
        }
      } catch (e) {
        log.error("session.idle error (contained)", { error: e?.message })
      }
    },
  }
}

export default VictoriousMemoryPlugin;
