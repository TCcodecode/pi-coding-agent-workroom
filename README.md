# Pi Workroom

> The desktop workspace for the [Pi coding agent](https://github.com/earendil-works/pi).

Run and resume Pi sessions, review agent changes, manage MCP tools, search code locally, and verify APIs from one local Electron workspace.

[中文 README](README.zh-CN.md) · [Releases](https://github.com/TCcodecode/pi-coding-agent-workroom/releases) · [Report an issue](https://github.com/TCcodecode/pi-coding-agent-workroom/issues) · [Pi coding agent](https://github.com/earendil-works/pi)

<!-- Screenshot placeholder: add docs/images/hero.png here. See docs/readme-assets.md for the capture plan. -->

## Why Pi Workroom?

Pi is excellent in the terminal. Long-running coding work also needs a durable place to see what is happening across projects and sessions: the plan, tool calls, file changes, API checks, and the next follow-up.

Pi Workroom is the desktop layer around Pi. It does not replace Pi or create another agent runtime. Pi remains the source of truth for models, providers, tools, extensions, and session semantics.

## What you can do

| Area | What it gives you |
| --- | --- |
| **Agent workspace** | Multiple projects, sessions, tabs, session trees, plans, todos, and follow-ups |
| **Live review** | A streaming timeline of replies and tool calls, plus unified file diffs |
| **MCP and code search** | Project-aware MCP configuration, Cursor MCP import, local symbol search, and usage lookup |
| **HTTP Workbench** | Repeatable `.http` tests, environments, run history, timing, errors, and sanitized responses |

<!-- Screenshot placeholder: add a 2×2 feature grid after this table. See docs/readme-assets.md. -->

## Install

### Download a release

Download the build for your platform from [GitHub Releases](https://github.com/TCcodecode/pi-coding-agent-workroom/releases).

| Platform | Available package |
| --- | --- |
| macOS | `.dmg` and `.zip` |
| Windows | NSIS installer and `.zip` |
| Linux | `.AppImage`, `.deb`, and `.tar.gz` |

The current pre-release is titled Pi Workroom, but its package asset names still use the former **PiDesk** name because it was built before the rename. It is the same project; future packages use the Pi Workroom name. macOS packages are not yet Developer ID signed or notarized, so macOS may require opening the app from Finder the first time.

### Run from source

Requires Node.js 22.12.0 or later.

```bash
git clone https://github.com/TCcodecode/pi-coding-agent-workroom.git
cd pi-coding-agent-workroom
npm install
npm run dev
```

If Electron is missing after installation, run:

```bash
npm install --include=dev
npm rebuild electron
npm run dev
```

## First five minutes

1. Open a local project folder.
2. Create a Pi session or resume one you started in the terminal.
3. Configure a model provider through Settings if Pi is not already configured.
4. Send a task and follow its timeline, tool calls, plan, and file changes.
5. Turn recurring API checks into `.http` tests in HTTP Workbench.

Pi Workroom continues to use Pi's sessions, provider setup, skills, extensions, and MCP ecosystem.

## How it fits with Pi

| Pi owns | Pi Workroom owns |
| --- | --- |
| Models, providers, tool loop, extensions, session semantics | Desktop windows, project workspace, visual review, local integrations |
| Pi session files and configuration | Project catalog, HTTP Workbench assets, code-index presentation |

The renderer communicates with the Electron main process through typed IPC. It does not receive unrestricted file system, shell, or Node.js access.

## Local data and security

- Pi session files remain under Pi's own session system.
- Project registration and HTTP Workbench state live in the application's local data directory.
- Code indexes are stored in `<project>/.code-index/` and do not require a cloud indexing service.
- Electron `contextIsolation` and sandboxing reduce renderer privilege, but Pi Workroom is not an operating-system security sandbox. Use a container, virtual machine, or another controlled environment when strong isolation is required.

## Development

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The project is organized into four product surfaces: `app`, `session`, `workspace`, and `http`. Pi runtime semantics stay in the main-process Pi host; the renderer presents projected state through `window.pi`.

## Contributing and support

Please use [Issues](https://github.com/TCcodecode/pi-coding-agent-workroom/issues) for bug reports and focused feature proposals. Include your platform, Pi Workroom version, reproduction steps, and relevant logs. Remove API keys, cookies, tokens, and private paths before sharing.

## Visual assets to add

The README is ready for real product visuals. The exact screenshots and demo to capture are listed in [docs/readme-assets.md](docs/readme-assets.md).

## License and acknowledgements

No project license has been declared yet. Do not assume redistribution or reuse rights until the maintainer publishes one.

Pi Workroom is built around:

- [Pi Agent Harness](https://github.com/earendil-works/pi)
- [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
