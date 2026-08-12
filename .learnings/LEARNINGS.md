# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260813-001] correction

**Logged**: 2026-08-13T02:05:00+08:00
**Priority**: critical
**Status**: pending
**Area**: frontend

### Summary
For PI Desk session-switch instability, renderer memory/CPU telemetry must determine root-cause priority over event-path correlation.

### Details
The initial investigation correctly found background session event and tab-identity races, but treated them as the primary cause of the freeze. The user measured the renderer at 100–190% CPU, roughly 14 GB peak memory, and heavy swap while the model was not continuously producing output. This establishes Timeline full recomputation/rendering after the recent hot update as the primary fault; IPC and identity races are secondary amplifiers that become more likely once rendering stalls.

### Suggested Action
Profile Timeline render and derived-data allocations first. Ensure stable memoization, incremental updates, and windowed rendering for long timelines; then retain session-key validation and background-event throttling as hardening work. Add a regression test or benchmark that asserts bounded render work and heap growth for a long, mostly idle timeline.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/components/Timeline.tsx, src/renderer/App.tsx, src/renderer/state/appStore.ts
- Tags: timeline, performance, memory, rendering, session-tabs, correction

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

## [LRN-20260809-005] correction

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
When the user asks to push a README change directly, the final target is the requested remote branch, not an intermediate feature branch.

### Details
The README rewrite was committed and pushed to `codex/rewrite-readme`, then that remote branch was deleted, but the change was not fast-forwarded to `origin/main`. The user clarified that the README must land directly on the remote `main` branch without a pull request.

### Suggested Action
Before creating a feature branch for a direct-push request, verify the requested destination branch. If the user explicitly wants direct delivery to `main`, fast-forward or amend `main` and push it directly; do not create a PR unless asked.

### Metadata
- Source: user_feedback
- Related Files: README.md
- Tags: git, github, branch, direct-push

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

## [LRN-20260809-004] correction

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
The README comparison target named Resonix is `esengine/deepseek-reasonix`.

### Details
The initial repo search interpreted “Resonix” as unrelated repositories, including an AI agent named Resonix-AG. The user provided the exact repository URL, which should be treated as the source of truth for the README research.

### Suggested Action
When a product name is ambiguous, ask for or verify the exact repository URL before selecting comparison projects.

### Metadata
- Source: user_feedback
- Related Files: README.md
- Tags: github, readme, product-identification

---

## [LRN-20260810-005] correction

**Logged**: 2026-08-10T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
The first pass on the change-summary file row was inferred from the reference image without verifying the user's current rendered state.

### Details
The reference image alone does not establish whether the highlighted gray surface is a default single-file state, a hover state, or a layout mismatch in the current app. The implementation should compare the actual rendered card before making further visual claims.

### Suggested Action
For screenshot-driven UI corrections, capture or inspect the current app state and compare computed layout/selector precedence against the reference before iterating again.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/components/Timeline.tsx, src/renderer/styles.css
- Tags: visual-regression, change-summary, screenshot-comparison

---

## [LRN-20260811-006] correction

**Logged**: 2026-08-11T09:29:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
Shared interaction tokens do not guarantee shared hover colors when nested controls and higher-specificity selectors keep their own backgrounds.

### Details
The project row, its inner project toggle, the session row, and the Settings sidebar action were rendered by different DOM layers. A parent row could use the shared `#e9e9e9` surface while the hovered child still used `var(--surface-hover)` or was forced transparent, producing visibly different hover colors.

### Suggested Action
When standardizing interactive states, audit the full hover target hierarchy and override both the visual row and its nested interactive child with the same semantic token. Test parent-hover and child-hover paths separately.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles.css, src/renderer/components/SessionSidebar.tsx
- Tags: design-system, hover-state, specificity, visual-regression

---

## [LRN-20260811-007] correction

**Logged**: 2026-08-11T09:33:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
Selection background geometry must be owned by the list container; full-width child rows combined with ad hoc margins remove the intended inset and row gap.

### Details
The session list had a zero left margin and nested session rows were forced to `width: 100%`. The row's background therefore filled the whole child list, while its visual indentation existed only as text padding. The result looked like the selected session had no surrounding padding.

### Suggested Action
Define explicit sidebar selection inset and gap tokens. Let the list container provide horizontal/vertical spacing, and let each row own only its rounded background and content padding. Avoid mixing width, margin, and padding to simulate hierarchy.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles.css, src/renderer/components/SessionSidebar.tsx
- Tags: layout-contract, selection-surface, spacing, sidebar

---

## [LRN-20260811-008] correction

**Logged**: 2026-08-11T09:42:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
The right inspector was visually inconsistent because its legacy tab, tree, and control rules bypassed the global interaction tokens.

### Details
The right pane combined accent-colored selected tabs, dark-era local hover surfaces, and separate Index/Changes rules. A shared theme token only helps components that explicitly consume it, so the pane needed a scoped interaction contract covering its tabs, rows, tree items, controls, and focus states.

### Suggested Action
When a whole panel should match global interaction feedback, add a panel-level audit and route every neutral interactive state through the same hover, selected, and focus tokens. Keep semantic status colors separate from the interaction surface.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles.css, src/renderer/theme.test.ts
- Tags: design-system, right-pane, interaction-contract, specificity

---
