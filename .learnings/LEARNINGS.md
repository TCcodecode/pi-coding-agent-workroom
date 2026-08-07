# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260809-004] correction

**Logged**: 2026-08-09T13:21:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
When a screenshot points into a composite layout, confirm the exact sub-region before changing a neighboring panel.

### Details
The user intended the HTTP editor line-number gutter to be narrower, but the first interpretation changed the left navigation width. The correct fix is to restore the shared left navigation width and adjust only the editor gutter.

### Suggested Action
Map screenshot coordinates to the layout boundaries and verify the targeted CSS region before editing adjacent columns.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/components/HttpWorkbench.tsx, src/renderer/styles.css
- Tags: layout, screenshot, line-number-gutter, correction

---

## [LRN-20260809-001] correction

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
An unused unpinned Tab should be closed before opening the next session, not described as a reusable slot.

### Details
The user clarified that the desired interaction is a lifecycle change: discard the temporary Tab with no conversation, then create the next session with its own Tab identity. The implementation must preserve pinned or meaningful conversation Tabs.

### Suggested Action
Keep the disposable-session predicate explicit, but model the transition as remove-old-Tab plus add-new-Tab rather than reuse-slot language or identity.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/state/sessionTabs.ts, src/renderer/App.tsx
- Tags: tabs, sessions, lifecycle, ui

---

## [LRN-20260809-001] correction

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: product

### Summary
HTTP Workbench tests are app-owned assets and should not be stored under the project repository by default.

### Details
The project association is needed for context and organization, but the `.http` files are not intended to be committed or submitted with the project. The canonical storage should therefore be under the PI Desk application data root, partitioned by project identity, with Scratch and formal test suites separated there.

### Suggested Action
Use the Electron `userData` directory as the storage root, bind each test workspace to a stable `projectId`, and keep project paths only as metadata. Do not make `tests/http` inside the repository the default location.

### Metadata
- Source: user_feedback
- Related Files: electron/projectCatalog.ts, electron/main.ts
- Tags: http-workbench, app-data, project-binding, storage

---

## [LRN-20260808-001] probe-and-suite-boundary

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: product

### Summary
HTTP capability should preserve both fast shell probes and managed regression suites.

### Details
The user explicitly allows the Agent to use curl or Bash for quick validation. The managed `.http` runner is for repeatable, structured, environment-aware, approval-gated suite execution, not for every ad-hoc request.

### Suggested Action
Design two execution modes: Probe (shell/curl, ephemeral) and Suite (`.http`, structured and auditable), with an explicit promotion path from probe findings to a reusable test.

### Metadata
- Source: user_feedback
- Related Files: none
- Tags: http-tests, agent, regression, curl

---

## [LRN-20260808-002] correction

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
The requested Codex-like shell uses darker side rails and the deepest center, not light side panels.

### Details
The initial interpretation treated “旁边是浅色的，中间是深色的” as light gray or white sidebars. The supplied reference clarified that the intended palette is still dark: the left rail is medium-dark gray, the central work area is darkest, and the right inspector is a slightly lighter dark surface.

### Suggested Action
For future UI comparisons, interpret “light/dark” relationally within the dark theme and use the provided reference image as the source of truth for surface hierarchy.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles.css
- Tags: ui, color, codex, dark-theme

---

## [LRN-20260808-001] correction

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
The user clarified that the product under discussion is Cloudflare Kitesurf, not Browser Run.

### Details
The initial research followed the phrase “Cloudflare new headless browser” to Browser Run. The user corrected the product name to Kitesurf, which is a separate agent-first browser project announced by Cloudflare.

### Suggested Action
When a product name is supplied after a correction, restart product identification and re-check first-party sources before continuing the comparison.

### Metadata
- Source: user_feedback
- Tags: cloudflare, kitesurf, product-identification

---

## [LRN-20260809-003] correction

**Logged**: 2026-08-09T11:20:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
An internal Preview Tab state change is not sufficient unless the actual click-to-open path visibly replaces the previous tab.

### Details
The first implementation modeled `isPreview` and added state-level tests, but the user still observed every clicked tab remaining. This means the behavior must be verified through the real session-opening entry points and rendered tab state, not only through the working-set helper. The desired rule is observable: opening a new empty session must remove the previous uncommitted tab from the tab strip immediately.

### Suggested Action
Trace every session-open entry point, add an App-level regression test or equivalent observable test, and ensure replacement happens synchronously before asynchronous session startup can reinsert or preserve the old tab.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/App.tsx, src/renderer/state/sessionTabs.ts
- Tags: tabs, preview-tab, regression, integration-test

---
