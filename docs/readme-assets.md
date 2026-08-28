# Pi Workroom README visual capture plan

Use real Pi Workroom screens only. Do not use mockups, synthetic UI, API keys, private paths, customer data, or model credentials.

## Captured assets

| File | Placement | Actual size | What it proves |
| --- | --- | --- | --- |
| `docs/images/hero.png` | Below the README intro | 1224×768 PNG | Desktop session, tool timeline, verified change, and review entry point |
| `docs/images/changes.png` | Feature grid | 1224×768 PNG | Unified Diff and review state |
| `docs/images/http-workbench.png` | Feature grid | 1224×768 PNG | A `.http` request with a successful JSON response and run history |
| `docs/images/companion-mobile.png` | Phone Companion section | 430×932 PNG | A phone-sized Companion reviewing the same file Diff |

## Optional next assets

- `docs/images/mcp-code-search.png`: MCP settings or local symbol search, if it adds a clearer product story.
- `docs/images/demo.gif` or `docs/images/demo.mp4`: 20–30 seconds showing project → session → diff → HTTP check.
- GitHub social preview: a 1280×640 PNG uploaded through Repository Settings, using a real cropped product screen and the phrase “Desktop workspace for the Pi coding agent”.

## Capture rules

- Use a realistic repository and a normal coding task, not an empty welcome state.
- Make the task legible at a glance: session name, tool call, diff, and project context should all have a purpose.
- Prefer one clear product story per image over a crowded collage.
- Redact API keys, tokens, emails, hostnames, private project names, and absolute personal paths.
- Use the same theme and window scale across images so the README feels like one product.
- Export PNG for screenshots. Keep the social preview under 1 MB.

## README insertion order

1. `hero.png` appears immediately after the language and release links in both README files.
2. `changes.png` and `http-workbench.png` appear after the capability table.
3. `companion-mobile.png` appears in the phone Companion section.
4. A future demo or social preview can be added without changing the current README structure.
