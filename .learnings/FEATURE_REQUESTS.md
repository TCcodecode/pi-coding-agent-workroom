# Feature Requests

Capabilities requested by the user.

---

## [FEAT-20260814-001] user_controlled_desktop_updates

**Logged**: 2026-08-14T00:00:00+08:00
**Priority**: high
**Status**: in_progress
**Area**: frontend

### Requested Capability
Show a left-sidebar update indicator; download and install a new desktop version only after the user chooses to do so.

### User Context
Release users should not need to revisit the download page, but must be free to defer upgrades.

### Complexity Estimate
medium

### Suggested Implementation
Use electron-updater with GitHub Release metadata. Check in the background, expose only available/downloaded states to the renderer, and require explicit download and restart actions. Keep unsigned macOS on manual updates until Developer ID signing is available.

### Metadata
- Frequency: first_time
- Related Features: release-distribution

---

## [FEAT-20260808-001] http-scratch-project-test-runner

**Logged**: 2026-08-08T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Requested Capability
Add an IntelliJ HTTP Client-style Scratch experience to the Agent, with project-managed HTTP test packages that the Agent can execute and maintain.

### User Context
The user wants a stable, testable tool usable in real work, closer to an IDE-integrated HTTP client than Postman/Insomnia, and connected to the Agent's project and test workflow.

### Complexity Estimate
complex

### Suggested Implementation
Start with a small request document model and a deterministic HTTP execution service behind Electron IPC. Then add a scratch editor/result pane and persist named test files under the project so Agent tools can discover and run them. Add redaction, timeouts, cancellation, assertions, and fixture/environment support incrementally.

### Metadata
- Frequency: first_time
- Related Features: mcp-integration, project-catalog

---
