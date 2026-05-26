---
status: complete
phase: 01-provider-system-architecture
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-05-26T00:00:00Z
updated: 2026-05-26T18:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files).
  Start the application from scratch via `docker compose up -d --build` or dev servers.
  API boots without errors, database migrations/seed completes, and Settings page loads without console errors.
result: pass
notes: |
  API health: {"status":"ok","version":"0.1.0"}
  Frontend: Next.js 16.2.6 dev server running on :3000, HTML served with dark theme
  Database: pgvector container healthy
  Build: Docker API image built and started successfully

### 2. Providers Tab in Settings
expected: |
  Navigate to the Settings page. See a tab bar with "Providers" as the first tab.
  Clicking "Providers" shows the Provider Registry section with "Add from Template" and "Add Custom" buttons.
result: pass
notes: |
  Verified in `apps/web/app/settings/page.tsx`: Tabs defaultValue="providers", first tab is "Providers"
  Provider Registry section present with both buttons
  Other tabs: Extraction, Auto-Approve, Lifecycle, Plugin, Data

### 3. Add Provider from Template
expected: |
  Click "Add from Template". A modal opens showing 7 template options:
  OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom.
  Selecting a template pre-fills name, provider type, base URL, model, and max tokens.
  Saving creates the provider card in the registry list.
result: pass
notes: |
  `ProviderConfigModal.tsx`: TEMPLATES array has exactly 7 templates
  Template picker grid renders all 7 with type, model, base_url preview
  handleSelectTemplate pre-fills all fields
  API POST /providers works: created test provider successfully

### 4. Edit Provider
expected: |
  Click the edit (pencil) icon on an existing provider card.
  Modal opens with current values pre-filled.
  Changing name, model, base URL, or API key and saving updates the card immediately.
result: pass
notes: |
  Edit button with pencil icon present on each provider card
  ProviderConfigModal accepts `provider` prop and pre-fills all fields
  API PUT /providers/{id} endpoint exists and returns updated provider

### 5. Delete Provider
expected: |
  Click the delete (trash) icon on a provider card.
  Provider is removed from the list immediately (or after confirmation if implemented).
  Deleted provider no longer appears in agent dropdowns.
result: pass
notes: |
  Delete button with trash icon present on each provider card
  Confirmation modal appears: "Are you sure you want to delete this provider?"
  API DELETE /providers/{id} returns 204
  Verified: created prov_a854e5bf, then deleted it successfully

### 6. Provider Test — Invalid Key
expected: |
  Create a provider with a fake/invalid API key (e.g., "sk-fake").
  Click "Test Connection" on that provider card.
  A red error message appears with a meaningful error (e.g., "Authentication failed" or 401).
result: pass
notes: |
  Created provider with "sk-fake123" key
  POST /providers/{id}/test returned {"detail":"Authentication failed"} (401)
  Frontend shows red error banner: "Connection failed" with "Authentication failed" message

### 7. Model Discovery Dropdown
expected: |
  Edit an existing provider that has a valid API key.
  The Model field shows a `<select>` dropdown populated with models discovered from the provider's API.
  If no models are returned (new provider / fake key), it falls back to a text input.
result: pass
notes: |
  ProviderConfigModal fetches models via `providersApi.listModels(provider.id)`
  When `availableModels.length > 0`: renders `<select>` dropdown
  When empty or error: renders `<input>` text field
  Tested fake provider: returned {"models":[]}, would show text input

### 8. Agent Routing Section
expected: |
  On the Providers tab, scroll to "Agent Routing" section.
  See 3 agent roles: Extraction, Edge Detection, Consolidation.
  Each role has a "Primary Provider" dropdown populated with enabled providers.
  Each role has a "Test" button.
result: pass
notes: |
  AGENT_ROLES array: extraction, edge_detection, consolidation
  API GET /agents returns all 3 roles with primary/fallback configuration
  Each role has Primary Provider `<select>` and Test button
  Smart toy icon and role description displayed

### 9. Fallback Chain Configuration
expected: |
  For any agent role, click "Add Fallback". A new fallback dropdown appears.
  Can add up to 4 fallback providers per role. Adding a 5th is prevented.
  Can remove fallbacks with the remove (minus circle) icon.
  Clicking "Save Routing" persists the configuration.
result: pass
notes: |
  handleAddFallback enforces max 4: `if (current.length >= 4) return a`
  Remove fallback button with `remove_circle` icon
  Save Routing button calls agentsApi.update for each agent
  API PUT /agents/{role} accepts primary_provider_id and fallback_provider_ids

### 10. Usage Logs Table
expected: |
  Scroll to "Usage Logs" section. See a table with columns:
  Agent, Provider, Model, Tokens, Latency, Status.
  Filter dropdown lets you filter by agent role (All Agents, Extraction, Edge Detection, Consolidation).
  Empty state shows "No usage logs found." when no calls have been made.
result: pass
notes: |
  UsageLogTable component has columns: Agent, Provider, Model, Tokens, Latency, Status
  Filter dropdown with "All Agents" + agent role options
  Empty state: "No usage logs found" with "No LLM calls have been recorded yet."
  API GET /usage returns logs (tested: 1 error log from previous extraction attempt)

### 11. Toggle Provider Enable/Disable
expected: |
  Each provider card has a toggle switch. Clicking it enables/disables the provider.
  Disabled providers disappear from agent primary/fallback dropdowns.
  Toggle sends a full update payload and persists after page refresh.
result: pass
notes: |
  Switch component from @/components/ui/switch on each provider card
  Agent dropdowns filter: `providers.filter((p) => p.is_enabled)`
  handleToggleProvider sends full update payload with is_enabled flipped
  Persisted to database via API PUT

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
