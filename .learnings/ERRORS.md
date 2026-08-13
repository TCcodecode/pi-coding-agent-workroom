# Errors

Command failures and integration errors.

---

## [ERR-20260814-001] updater_api_integration

**Logged**: 2026-08-14T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Adding required updater IPC methods left the full PiApi test fake incomplete; the dependency insertion also duplicated an existing key.

### Error
```text
Type PiApi fake is missing getUpdateState, checkForUpdate, downloadUpdate, installUpdate, onUpdateState
Duplicate key "electron-updater" in package.json
```

### Context
- The first typecheck after implementing optional user-initiated updates caught both issues.
- No release or user data was affected.

### Suggested Fix
Update complete PiApi fakes whenever the protocol grows, and inspect dependency placement before patching package.json.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/app.send-flow.test.tsx, package.json

---

## [ERR-20260814-002] updater_release_name_nullability

**Logged**: 2026-08-14T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
electron-updater permits a null release name while the renderer update protocol intentionally exposes optional strings only.

### Error
```text
Type 'string | null | undefined' is not assignable to type 'string | undefined'
```

### Context
- Typecheck caught the value boundary in the updater state mapper.

### Suggested Fix
Normalize nullable upstream metadata to undefined before crossing the IPC protocol.

### Metadata
- Reproducible: yes
- Related Files: electron/updates.ts, src/shared/protocol.ts

---

## [ERR-20260812-004] global_fake_session_behavior

**Logged**: 2026-08-12T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Adding `setModel` to the shared fake session changed constructor-time behavior across unrelated tests that load persisted mode profiles.

### Error
```text
model-list tests unexpectedly included openai/gpt-5 and excluded their assigned current model
```

### Context
- PiHost applies a persisted profile asynchronously when a session exposes `setModel`.
- The shared fake intentionally omits optional capabilities unless a test requires them.

### Suggested Fix
Attach optional fake methods only within the tests that exercise them.

### Metadata
- Reproducible: yes
- Related Files: electron/piHost.test.ts

---

## [ERR-20260812-003] restricted_test_artifact_cleanup

**Logged**: 2026-08-12T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The terminal safety policy rejected removal of a known temporary test artifact with `rm -f`.

### Error
```text
rm -f style commands are not permitted. Use a safer approach
```

### Context
- Target: the isolated test's leaked `/tmp/project/.pai/session-modes.json` file.
- The file will be moved to a new `mktemp` directory instead, preserving recoverability.

### Suggested Fix
Move test artifacts out of shared locations or use per-test temporary directories from the start.

### Metadata
- Reproducible: yes
- Related Files: electron/piHost.test.ts

---

## [ERR-20260812-002] shared_test_mode_state

**Logged**: 2026-08-12T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A new PiHost test reused the default `/tmp/project` working directory and persisted PlanMode state that affected a later test.

### Error
```text
refreshAvailableModels ignores ambient env providers: expected the current Anthropic model to be listed, but only DeepSeek models were returned
```

### Context
- The test changed a model profile, which writes `.pai/session-modes.json` under its runtime cwd.
- Existing tests use a shared default cwd unless explicitly isolated.

### Suggested Fix
Use a fresh `mkdtempSync` cwd for every test that mutates mode profiles and remove it in `finally`.

### Metadata
- Reproducible: yes
- Related Files: electron/piHost.test.ts

---

## [ERR-20260812-001] package_subpath_export

**Logged**: 2026-08-12T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A diagnostic script imported an internal package file through a package subpath that is not exported.

### Error
```text
ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './dist/core/auth-storage.js' is not defined by "exports"
```

### Context
- Read-only investigation of Pi credential refresh behavior.
- No user credentials or project source data were written or exposed.

### Suggested Fix
For package-internal diagnostics, resolve the file from the workspace's `node_modules` path with a file URL, or use a public export.

### Metadata
- Reproducible: yes
- Related Files: node_modules/@earendil-works/pi-coding-agent/dist/core/auth-storage.js

---

## [ERR-20260810-001] rg_pattern_starts_with_option

**Logged**: 2026-08-10T19:47:30+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
An `rg` summary command treated a pattern beginning with `--` as a command-line option.

### Error
```text
rg: unrecognized flag --surface-center|--surface-sidebar|--surface-inspector|--surface-topbar|--surface-code|--accent-primary|light-status-pulse|http-workbench-shell.theme-light
```

### Context
- The command was a read-only final summary check after the implementation and build had already passed.
- No project files or source data were affected.

### Suggested Fix
Use `rg -- "pattern"` whenever a search expression may begin with a hyphen.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260809-003] verification_orchestration_variable

**Logged**: 2026-08-09T13:23:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The full verification orchestration script referenced an undefined loop variable while reporting session ids.

### Error
```text
ReferenceError: name is not defined
```

### Context
- The build and test commands were launched, but the JavaScript wrapper failed while formatting the results.
- The project commands themselves were not the source of the failure.

### Suggested Fix
Use the destructured result name consistently when formatting parallel command output.

### Metadata
- Reproducible: no
- Related Files: none

---

## [ERR-20260809-002] visual_design_skill_path_resolution

**Logged**: 2026-08-09T01:05:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The visual design skill was first read using the alias name as a literal path.

### Error
```text
sed: /Users/tc/.codex/skills/r0/visual-design-foundations/SKILL.md: No such file or directory
```

### Context
- The skill catalog maps `r0` to `/Users/tc/.codex/skills`; the alias is not part of the filesystem path.
- The correct path was read immediately afterward.

### Suggested Fix
Resolve the skill-root alias before appending the skill directory.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260809-001] imagegen_skill_path_resolution

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The imagegen skill was first read from an incorrect filesystem path instead of its mapped system skill root.

### Error
```text
sed: /Users/tc/.codex/skills/imagegen/SKILL.md: No such file or directory
```

### Context
- The catalog maps `r2` to `/Users/tc/.codex/skills/.system`, so the skill is located under `.system/imagegen`.

### Suggested Fix
Resolve the skill-root alias before appending the skill directory.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260808-001] skill_path_resolution

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The first attempt treated a skill-root alias as a literal filesystem path.

### Error
```text
sed: /Users/tc/.codex/skills/r0/karpathy-guidelines/SKILL.md: No such file or directory
```

### Context
- Attempted to read the required skill before inspecting the project.
- The catalog maps `r0` to `/Users/tc/.codex/skills`; it is not part of the path.

### Suggested Fix
Expand the skill root alias before appending the skill directory.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260808-002] self_improvement_skill_path_resolution

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The self-improvement skill was initially looked up under the wrong skill root.

### Error
```text
sed: /Users/tc/.codex/skills/self-improvement/SKILL.md: No such file or directory
```

### Context
- `self-improvement` is provided by skill root `r1`, mapped to `/Users/tc/.agents/skills`.

### Suggested Fix
Use the catalog mapping for each skill independently.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260809-001] github_skill_read_command

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The first attempt to read the GitHub skill file failed due to malformed shell quoting.

### Error
```text
zsh:1: unmatched '
```

### Context
- Attempted to read the GitHub skill before verifying the corrected repository.
- The failure was caused by the command string, not by the skill file or repository.

### Suggested Fix
Use consistent quoting or double-quote the absolute skill path when invoking `sed`.

### Metadata
- Reproducible: no
- Related Files: none

---

## [ERR-20260809-002] commit_tool_call_syntax

**Logged**: 2026-08-09T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The first commit invocation failed before execution because the tool orchestration object was missing a comma.

### Error
```text
SyntaxError: Unexpected identifier 'max_output_tokens'
```

### Context
- The intended command was `git commit -m "docs: rewrite README"`.
- No Git operation ran and the staged files were unchanged.

### Suggested Fix
Validate JavaScript tool-call object syntax before invoking the command.

### Metadata
- Reproducible: no
- Related Files: none

---

## [ERR-20260810-002] light_theme_audit_regex

**Logged**: 2026-08-10T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
The first audit search for legacy light-theme colors failed because a complex regular expression had an unmatched group.

### Error
```text
rg: regex parse error: unopened group
```

### Context
- The audit was read-only and no source files were affected.
- The command combined multiple alternations and escaped parentheses in one pattern.

### Suggested Fix
Prefer several fixed-string `rg` checks or a simpler pattern when auditing CSS color literals.

### Metadata
- Reproducible: no
- Related Files: src/renderer/styles.css

---

## [ERR-20260811-001] full_test_stale_focus_ring_expectation

**Logged**: 2026-08-11T01:09:19Z
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
The full test suite has one stale focus-ring assertion after the light-theme token changed.

### Error
```text
src/renderer/interaction.test.ts expects --focus-ring: 0 0 0 2px rgba(32, 32, 32, .18),
but src/renderer/styles.css defines the current light-theme focus ring.
```

### Context
- `npm test -- --run` completed with 405 passing tests and this one unrelated failure.
- The focus-ring CSS and its assertion were already modified before the tab repair.

### Suggested Fix
Update the interaction test to assert the approved current focus-ring token, or restore the token if the previous visual contract remains intended.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/interaction.test.ts, src/renderer/styles.css

---

## [ERR-20260811-002] web_result_wrapper_assumption

**Logged**: 2026-08-11T01:21:05Z
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
The web research wrapper assumed every tool result exposed a `content` array.

### Error
```text
TypeError: r.content is not iterable
```

### Context
- A combined web and image search returned a different result shape.
- The search itself was not the failure; only result rendering failed.

### Suggested Fix
Serialize or forward the returned value directly unless its wrapper shape is known.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-08-11T01:21:05Z
- **Notes**: Subsequent research uses the tool result directly.

---

## [ERR-20260811-003] full_test_session_tab_shortcut_assertions

**Logged**: 2026-08-11T13:19:30+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The full test suite has three unrelated `SessionTabBar` failures because shortcut text is rendered as separate key elements.

### Error
```text
Unable to find an element with the text: /^(⌘1|Ctrl\\+1)$/
Expected Ctrl+1, received textContent Ctrl1
```

### Context
- `npm test -- --run` completed with 46 passing test files and 3 failing tests in `src/renderer/components/SessionTabBar.test.tsx`.
- The Settings-specific tests passed; this failure is outside the Settings files changed in this task.

### Suggested Fix
Update the SessionTabBar assertions to query the shortcut group or normalize the separate `<kbd>` nodes before matching the displayed shortcut.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/components/SessionTabBar.test.tsx, src/renderer/components/SessionTabBar.tsx

### Resolution
- **Resolved**: 2026-08-11T13:20:30+08:00
- **Notes**: Kept the existing shortcut label rendering and aligned shortcut styling with the topbar instead of splitting tab labels into separate key nodes. Full suite now passes: 47 test files, 415 tests.

---

## [ERR-20260811-004] theme_test_hover_block_scope

**Logged**: 2026-08-11T18:11:33Z
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The sidebar hover regression test searched from a comment to EOF, so it included a later intentional override.

### Error
```text
Expected the shared hover block not to include project child selectors.
```

### Context
- The final project-row override intentionally includes those selectors to keep child controls transparent.

### Suggested Fix
Scope the assertion to the shared hover rule instead of all subsequent CSS.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/theme.test.ts, src/renderer/styles.css

### Resolution
- **Resolved**: 2026-08-11T18:11:33Z
- **Notes**: Replaced the broad slice assertion with a selector-list assertion for the shared hover rule.

---

## [ERR-20260812-001] provider_error_test_event_broadcasts

**Logged**: 2026-08-12T23:21:33+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The provider-error event test omitted existing live-session status broadcasts from its exact event-list assertion.

### Error
```text
Expected only assistant, turn, and session-error events; received additional live_sessions_changed events.
```

### Context
- The host broadcasts live-session status after turn completion and after a terminal provider error.
- Those broadcasts are unrelated to the regression being tested.

### Suggested Fix
Assert the relevant normalized events while allowing independent live-session broadcasts.

### Metadata
- Reproducible: yes
- Related Files: electron/piHost.test.ts

### Resolution
- **Resolved**: 2026-08-12T23:21:33+08:00
- **Notes**: Narrowed the assertion to event types and the terminal error payload.

---
