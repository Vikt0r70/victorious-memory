# Phase 2: Dashboard Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 2-Dashboard Redesign
**Areas discussed:** Graph Visualization Strategy, Settings Page Scope, Component Standardization, Table Stability

---

## Graph Visualization Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A. Adopt react-force-graph-2d | Replace custom Canvas with industry-standard library | ✓ |
| B. Keep custom Canvas + add d3-force | Keep renderer, swap physics for d3-force simulation | |
| C. Minimal fixes only | Keep current graph, fix bugs, add hover tooltip | |

**User's choice:** Option A
**Notes:** User explicitly stated: "Let's nuke the custom renderer and bring in react-force-graph-2d." Rationale: (1) code deletion is a feature — ~600 lines of hand-rolled physics is an architectural trap, (2) velocity — library gives interactivity out of the box, (3) dependency trade-off is correct for a focused, industry-standard open-source library.

---

## Settings Page Scope

| Option | Description | Selected |
|--------|-------------|----------|
| A. Full redesign | Rebuild settings from scratch | |
| B. Redesign shell, keep content | New layout/styling but same 6 tabs and functionality | ✓ |
| C. Fix-only | Keep existing structure, fix bugs, tweak styling | |

**User's choice:** Option B
**Notes:** User confirmed this is "the exact right balance." Rationale: (1) preserves complex unified React state from Phase 1, (2) high ROI on CSS — 90% visual impact for 10% effort, (3) honors Phase 1 investment, keeps lean engineering philosophy intact.

---

## Component Standardization

| Option | Description | Selected |
|--------|-------------|----------|
| A. Adopt shadcn/ui (copy-paste) | Radix UI primitives styled with Tailwind, code lives in repo | ✓ |
| B. Continue pure Tailwind | Write all components from scratch | |

**User's choice:** Option A
**Notes:** User stated definitive take: "Adopt shadcn/ui (specifically the copy-paste components)." Rationale: Writing accessible, keyboard-navigable components from scratch is a massive time sink. shadcn/ui bridges fast and customizable perfectly.

---

## Table Stability

| Option | Description | Selected |
|--------|-------------|----------|
| A. Adopt TanStack Table (React Table v8) | Headless data-grid for sorting/pagination/filtering | ✓ |
| B. Fix native HTML table | Patch existing manual useState hooks | |

**User's choice:** Option A
**Notes:** User stated definitive take: "Adopt TanStack Table (React Table v8)." Rationale: Native HTML tables become spaghetti code nightmare for sorting/pagination/filtering. TanStack Table handles complex data-grid math while letting us style with Tailwind/shadcn. Aligns with "best-in-class" mandate.

---

## the agent's Discretion

- Exact shadcn/ui installation method (CLI vs manual copy)
- Specific animation/transition details
- Exact TanStack Table column definitions and default sort behavior
- Specific responsive breakpoints
- Exact wording of empty state messages

## Deferred Ideas

- Graph physics controls (gravity, charge, link distance) — P2 feature, future phase
- Graph preview on dashboard — P2 feature
- Virtualized lists for large tables — future optimization
- Notification history panel — P2 feature
- Data import UI — explicitly out of scope per PROJECT.md
- Mobile-responsive layout — desktop-first per constraints
