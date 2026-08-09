# Errors

Command failures and integration errors.

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
