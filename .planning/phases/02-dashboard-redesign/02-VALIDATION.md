---
phase: 02
slug: dashboard-redesign
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2025-10-15
updated: 2026-05-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | apps/web/vitest.config.ts |
| **Setup file** | apps/web/tests/setup.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds (53 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test File | Status |
|---------|------|------|-------------|-----------|--------|
| 02-01-01 | 01 | 1 | UX-01..UX-04, ARCH-02 | tests/components/ui/LoadingSpinner.test.tsx | ✅ COVERED |
| 02-01-01 | 01 | 1 | UX-01..UX-04, ARCH-02 | tests/components/ui/EmptyState.test.tsx | ✅ COVERED |
| 02-01-01 | 01 | 1 | UX-01..UX-04, ARCH-02 | tests/components/ui/ErrorBanner.test.tsx | ✅ COVERED |
| 02-01-02 | 01 | 1 | UX-01..UX-04, ARCH-02 | tests/components/layout/Sidebar.test.tsx | ✅ COVERED |
| 02-01-02 | 01 | 1 | UX-01..UX-04, ARCH-02 | tests/components/layout/TopBar.test.tsx | ✅ COVERED |
| 02-02-01 | 02 | 2 | UX-01..UX-04, ARCH-02 | tests/app/dashboard.test.tsx | ✅ COVERED |
| 02-02-02 | 02 | 2 | UX-01..UX-04, ARCH-02 | tests/app/graph.test.tsx | ✅ COVERED |
| 02-02-03 | 02 | 2 | UX-01..UX-04, ARCH-02 | tests/app/review.test.tsx | ✅ COVERED |
| 02-02-04 | 02 | 2 | UX-01..UX-04, ARCH-02 | tests/app/memories.test.tsx | ✅ COVERED |
| 02-02-05 | 02 | 2 | UX-01..UX-04, ARCH-02 | tests/app/jobs.test.tsx | ✅ COVERED |
| 02-03-01 | 03 | 2 | UX-01..UX-04, ARCH-02 | tests/app/settings.test.tsx | ✅ COVERED |
| 02-03-02 | 03 | 2 | UX-01..UX-04, ARCH-02 | tests/components/settings/UsageLogTable.test.tsx | ✅ COVERED |

*Status: ⬜ pending · ✅ COVERED · ❌ failing · ⚠️ flaky*

---

## Test Coverage by Page/Component

| Area | Test File | Test Count | Covers |
|------|-----------|------------|--------|
| LoadingSpinner | tests/components/ui/LoadingSpinner.test.tsx | 3 | rendering, animation, layout |
| EmptyState | tests/components/ui/EmptyState.test.tsx | 4 | props, default icon, custom icon, styling |
| ErrorBanner | tests/components/ui/ErrorBanner.test.tsx | 4 | message, icon, styling, empty prop |
| Sidebar | tests/components/layout/Sidebar.test.tsx | 4 | branding, nav items, cursor-pointer |
| TopBar | tests/components/layout/TopBar.test.tsx | 5 | title, buttons, search, notification dot |
| UsageLogTable | tests/components/settings/UsageLogTable.test.tsx | 4 | empty state, data, headers, filter |
| Dashboard | tests/app/dashboard.test.tsx | 6 | spinner, stat cards, activity, donut, empty, error |
| Graph | tests/app/graph.test.tsx | 5 | heading, empty state, filters, search, rendering |
| Review | tests/app/review.test.tsx | 5 | heading, buttons, empty, bulk, cursor-pointer |
| Memories | tests/app/memories.test.tsx | 4 | heading, empty, semantic toggle, search |
| Jobs | tests/app/jobs.test.tsx | 5 | heading, buttons, empty, filters, cursor-pointer |
| Settings | tests/app/settings.test.tsx | 4 | heading, 6 tabs, empty state, agent routing |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas visualization | REQ-05 | Canvas rendering requires browser viewport | Open graph page, verify nodes render with labels and edge colors |

---

## Validation Audit 2026-05-26

| Metric | Count |
|--------|-------|
| Tasks audited | 9 |
| Gaps found | 9 (all MISSING) |
| Resolved | 9 |
| Escalated | 0 |
| Test files created | 12 |
| Test cases | 53 |
| Framework installed | vitest, @testing-library/react, @testing-library/jest-dom, jsdom |

---

## Validation Sign-Off

- [x] All tasks have automated tests
- [x] 53 tests pass across 12 test files
- [x] `npm run test` completes in ~10s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Wave 0 complete — test infrastructure in place

**Approval:** 2026-05-26
