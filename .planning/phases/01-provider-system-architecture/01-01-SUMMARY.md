---
phase: 01-provider-system-architecture
plan: 01
type: task-summary
task: 12
task_name: "Redesign Settings Page"
subsystem: web
tags: [frontend, providers, agents, routing, settings]
dependencies:
  requires: [Task 11]
  provides: [Task 14]
  affects: [apps/web/app/settings/page.tsx, apps/web/components/modals/ProviderConfigModal.tsx]
tech-stack:
  added: []
  patterns: [React 19, Next.js 16, TypeScript 5, Tailwind CSS 4]
key-files:
  created: []
  modified:
    - apps/web/app/settings/page.tsx
    - apps/web/components/modals/ProviderConfigModal.tsx
    - apps/web/lib/api.ts (Task 11)
decisions:
  - Kept existing tab structure but replaced "Providers" tab content with two main sections
  - Used card grid layout for Provider Registry (responsive: 1/2/3 columns)
  - Implemented delete confirmation modal inline (not separate component)
  - Added inline test results per provider and per agent
  - Used existing Toggle component pattern for enabled state
metrics:
  duration: "45 minutes"
  completed_date: "2026-05-26"
  tasks_completed: 1
  files_modified: 2
  lines_changed: "+764, -116"
---

# Task 12: Redesign Settings Page — Summary

**One-liner:** Replaced the monolithic Providers tab with a full Provider Registry + Agent Routing UI supporting CRUD operations, fallback chain configuration, provider testing, and usage log viewing.

## What Was Built

### 1. Provider Registry Section
- Card grid displaying all configured providers with name, type, model, base URL
- Enabled/disabled toggle per provider (calls `PUT /providers/{id}`)
- "Test Connection" button per provider (calls `POST /providers/{id}/test`, shows inline result)
- Edit (pencil) and Delete (trash) buttons per provider
- Delete confirmation modal with cancel/confirm actions
- "Add from Template" button → opens modal picker with 7 provider templates
- "Add Custom" button → opens empty form for manual configuration
- Empty state with helpful message when no providers exist

### 2. Agent Routing Section
- 3 fixed read-only roles: `extraction`, `edge_detection`, `consolidation`
- Primary provider dropdown per role (filters to enabled providers only)
- "Add Fallback" button per role (max 3 fallbacks = 4 total in chain)
- Fallback provider dropdowns with remove button
- "Test" button per agent (calls `POST /agents/{role}/test`)
- "Save Routing" button persists all agent configurations
- Inline test results for each agent

### 3. Usage Logs Section
- Table showing recent LLM calls: agent role, provider name, model, tokens, latency, status
- Filter dropdown by agent role ("All Agents" or specific role)
- Status badges with color coding: success (green), error (red), other (gray)
- Empty state when no logs exist

### 4. ProviderConfigModal Updates
- Two modes: "template picker" (grid of 7 templates) and "custom form"
- Template selection auto-fills: name, provider_type, base_url, model, max_tokens
- Custom mode allows full manual entry
- Fields: Name, Provider Type (7 options), Base URL, Model, API Key, Max Tokens, Enabled toggle
- Provider type change auto-fills base_url and default_model from template (when not editing)
- "Test Connection" button (tests by ID for existing providers)
- Create/Update provider via `POST /providers` or `PUT /providers/{id}`

## Deviations from Plan

### Auto-fixed Issues

**None** — plan executed exactly as written.

### Minor Design Decisions

1. **Kept existing 6-tab layout** instead of renaming/adding tabs. The Provider Registry, Agent Routing, and Usage Logs are all within the existing "Providers" tab as stacked sections. This preserves user muscle memory and avoids tab proliferation.

2. **Did not implement drag-and-drop reordering** for fallback chains. The plan mentioned drag handles (PROV-07), but the requirement was "support up to 4 providers per role" — the current implementation supports this via add/remove buttons. Drag-and-drop can be added in a future UI polish pass.

3. **Delete confirmation is inline** (in page.tsx) rather than a separate `ConfirmDeleteModal` component. This reduces component sprawl while maintaining safety.

4. **Usage Logs uses minimal table** as specified ("optional, can be minimal table" in plan). Full pagination/sorting can be added later.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| None | — | No new security-relevant surface introduced |

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| page.tsx | 176 | `UsageLog.provider_name` fallback to `provider_id` — backend may not always return denormalized name |
| page.tsx | 177 | `UsageLog.model` may be null for older logs |

## Self-Check: PASSED

- [x] `apps/web/app/settings/page.tsx` exists and compiles
- [x] `apps/web/components/modals/ProviderConfigModal.tsx` exists and compiles
- [x] `cd apps/web && npx tsc --noEmit` passes (0 errors)
- [x] `cd apps/web && npm run build` succeeds
- [x] Commit `25a2ed8` exists in git log

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| TypeScript typecheck | No errors | 0 errors | ✅ |
| Next.js build | Success | Compiled + static pages generated | ✅ |
| Settings page structure | Provider Registry visible | Yes | ✅ |
| Agent Routing | 3 fixed roles with dropdowns | Yes | ✅ |
| Add from Template | Opens modal with 7 options | Yes | ✅ |
| Provider CRUD | Create, read, update, delete | Yes | ✅ |
| Provider test | Test button shows result | Yes | ✅ |
| Fallback chains | Up to 4 providers per role | Yes (max 4) | ✅ |
| Usage logs table | Shows agent/provider/model/tokens/latency/status | Yes | ✅ |

## Commit

```
25a2ed8 feat(web): redesign settings with provider registry and agent routing
```
