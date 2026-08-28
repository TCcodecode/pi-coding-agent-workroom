# Pi Workroom README visual capture plan

Use real Pi Workroom screens only. Do not use mockups, synthetic UI, API keys, private paths, customer data, or model credentials.

## Required assets

| File | Placement | Recommended size | What it should prove |
| --- | --- | --- | --- |
| `docs/images/hero.png` | Below the README intro | 1600×1000 PNG | The full desktop workspace: project sidebar, active session, tool timeline, and a visible change or plan |
| `docs/images/sessions.png` | Feature grid | 1200×900 PNG | Multiple projects or sessions and the session tree |
| `docs/images/changes.png` | Feature grid | 1200×900 PNG | A readable unified diff and review state |
| `docs/images/mcp-code-search.png` | Feature grid | 1200×900 PNG | MCP settings or local symbol search; use whichever tells the story more clearly |
| `docs/images/http-workbench.png` | Feature grid | 1200×900 PNG | An HTTP request, an environment, and a sanitized response or history row |
| `docs/images/demo.gif` or `docs/images/demo.mp4` | After the hero or feature table | 20–30 seconds | Open a project, resume a session, send a follow-up, inspect a diff, and run one HTTP check |
| GitHub social preview | Repository Settings → Social preview | 1280×640 PNG | Pi Workroom name, a real cropped product screen, and the phrase “Desktop workspace for the Pi coding agent” |

## Capture rules

- Use a realistic repository and a normal coding task, not an empty welcome state.
- Make the task legible at a glance: session name, tool call, diff, and project context should all have a purpose.
- Prefer one clear product story per image over a crowded collage.
- Redact API keys, tokens, emails, hostnames, private project names, and absolute personal paths.
- Use the same theme and window scale across images so the README feels like one product.
- Export PNG for screenshots. Keep the social preview under 1 MB.

## README insertion order

1. Add `hero.png` immediately after the language and release links in both README files.
2. Add the four feature screenshots after the first capability table as a 2×2 grid.
3. Add the demo after the hero or before Install when its file size is acceptable for GitHub rendering.
4. Upload the separate social preview through GitHub repository Settings; it does not need to live in this repository.
