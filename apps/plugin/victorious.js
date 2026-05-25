// Victorious Memory Plugin v1
// Automatically captures conversations and injects structured memory into every agent session.
//
// HOOKS:
//   experimental.chat.system.transform  → fetch memory context → inject into system prompt
//   chat.message                        → token counting → trigger ingest when threshold reached
//   tool.execute.after                  → accumulate assistant response parts
//   session.created                     → detect workspace project → reset state
//   session.idle                        → flush any pending exchange

const API     = process.env.VICTORIOUS_API_URL  || "http://localhost:8080"
const DEBUG   = process.env.VICTORIOUS_DEBUG === "true" || process.env.VICTORIOUS_DEBUG === "1"
const LOG_FILE = process.env.VICTORIOUS_LOG_FILE || ""

// Token threshold before we flush to ingest (approximate: 1 char ≈ 0.25 tokens)
const TOKEN_THRESHOLD = parseInt(process.env.VICTORIOUS_TOKEN_THRESHOLD || "500", 10)
const INJECT_TOKENS   = parseInt(process.env.VICTORIOUS_INJECT_TOKENS  || "1500", 10)

// ── Logging ──────────────────────────────────────────────────────────────────

const log = {
  _ts: () => new Date().toISOString(),
  _write(line) {
    if (LOG_FILE) {
      try { require("fs").appendFileSync(LOG_FILE, line + "\n") } catch {}
    }
  },
  info(msg, data = {}) {
    const entry = { ts: this._ts(), level: "info", msg, ...data }
    if (DEBUG) console.log(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
  warn(msg, data = {}) {
    const entry = { ts: this._ts(), level: "warn", msg, ...data }
    console.warn(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
  error(msg, data = {}) {
    const entry = { ts: this._ts(), level: "error", msg, ...data }
    console.error(`[VictoriousMemory] ${msg}`, Object.keys(data).length ? data : "")
    this._write(JSON.stringify(entry))
  },
}

// ── API Helper ───────────────────────────────────────────────────────────────

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(`${API}${path}`, opts)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      log.warn(`API ${method} ${path} → ${res.status}`, { body: text.slice(0, 200) })
      return null
    }
    return await res.json()
  } catch (e) {
    log.error(`API ${method} ${path} network error`, { error: e.message })
    return null
  }
}

// ── Token estimation ─────────────────────────────────────────────────────────

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4)
}

// ── Project detection from cwd ────────────────────────────────────────────────

function detectProjectFromCwd() {
  try {
    const cwd = process.cwd()
    return cwd.replace(/\\/g, "/")
  } catch {
    return null
  }
}

async function ensureProject(path) {
  if (!path) return null
  const result = await api("/api/projects/detect", "POST", { path })
  return result?.id || null
}

// ── State ─────────────────────────────────────────────────────────────────────

let sessionId     = null
let projectId     = null
let projectPath   = null

// Accumulate current exchange
let currentUser      = ""
let agentParts       = []   // [{type, content, tool, timestamp}]
let accumulatedTokens = 0

// ── Ingest helper ─────────────────────────────────────────────────────────────

async function flushExchange(reason = "threshold") {
  if (!currentUser && agentParts.length === 0) return

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

  const result = await api("/api/ingest", "POST", payload)
  if (result) {
    log.info("Exchange ingested", {
      reason,
      exchange_id:   result.exchange_id,
      job_id:        result.job_id,
      user_tokens:   estimateTokens(currentUser),
      parts:         agentParts.length,
      project_id:    projectId,
    })
  }

  // Reset exchange buffer
  currentUser       = ""
  agentParts        = []
  accumulatedTokens = 0
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const VictoriousMemoryPlugin = async ({ client }) => {
  // Detect workspace on startup
  projectPath = detectProjectFromCwd()
  sessionId   = `opencode-${Date.now()}`
  projectId   = await ensureProject(projectPath)

  log.info("Plugin initialized", {
    api: API,
    projectPath,
    projectId,
    sessionId,
    tokenThreshold: TOKEN_THRESHOLD,
    injectTokens:   INJECT_TOKENS,
  })

  return {
    // ── 1. BEFORE LLM CALL: inject memory context into system prompt ──────
    "experimental.chat.system.transform": async (input, output) => {
      if (!output?.system) return
      try {
        const params = new URLSearchParams({ tokens: INJECT_TOKENS })
        if (projectId)      params.set("project_id", projectId)
        if (input?.message) params.set("query", String(input.message || "").slice(0, 200))

        const ctx = await api(`/api/context?${params}`)
        if (!ctx?.block) {
          log.info("No memory context available yet")
          return
        }

        output.system.unshift(ctx.block)

        log.info("Memory injected", {
          memories_used: ctx.memories_used,
          project_id:    ctx.project_id,
          chars:         ctx.block.length,
        })
      } catch (e) {
        log.error("system.transform error", { error: e.message })
      }
    },

    // ── 2. WHEN USER SENDS MESSAGE: save previous exchange + start new one ─
    "chat.message": async (input, output) => {
      const userContent = output?.message?.content || ""
      if (!userContent) return

      // Flush previous exchange before starting new one
      if (currentUser || agentParts.length > 0) {
        await flushExchange("new_message")
      }

      // Start new exchange
      currentUser       = userContent
      accumulatedTokens = estimateTokens(userContent)

      log.info("New user message", {
        tokens: accumulatedTokens,
        project_id: projectId,
      })
    },

    // ── 3. AFTER TOOL EXECUTION: capture assistant response parts ──────────
    "tool.execute.after": async (input, output) => {
      const toolName = input?.tool?.name || input?.name || "unknown"
      const result   = output?.result

      if (result && typeof result === "string" && result.length > 5) {
        const part = {
          type:      "tool_call",
          tool:      toolName,
          content:   result.slice(0, 4000),
          timestamp: new Date().toISOString(),
        }
        agentParts.push(part)
        accumulatedTokens += estimateTokens(result)

        log.info("Tool result captured", {
          tool:   toolName,
          tokens: estimateTokens(result),
          total:  accumulatedTokens,
        })

        // Flush if over token threshold
        if (accumulatedTokens >= TOKEN_THRESHOLD) {
          log.info("Token threshold reached — flushing", { tokens: accumulatedTokens })
          await flushExchange("token_threshold")
        }
      }
    },

    // ── 4. SESSION CREATED: detect project from new working dir ──────────
    "session.created": async () => {
      // Flush any pending exchange from previous session
      await flushExchange("session_end")

      // Reset and re-detect
      const newPath = detectProjectFromCwd()
      if (newPath !== projectPath) {
        projectPath = newPath
        projectId   = await ensureProject(projectPath)
        log.info("Project switched", { projectPath, projectId })
      }

      sessionId = `opencode-${Date.now()}`
      log.info("Session created", { sessionId, projectId })
    },

    // ── 5. SESSION IDLE: flush any remaining exchange ─────────────────────
    "session.idle": async () => {
      if (currentUser || agentParts.length > 0) {
        log.info("Session idle — flushing exchange", { tokens: accumulatedTokens })
        await flushExchange("session_idle")
      }
    },
  }
}
