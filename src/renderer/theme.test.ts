import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/renderer/styles.css"), "utf8");

describe("PI Desk surface hierarchy", () => {
  it("defines the approved Codex-like dark depth palette", () => {
    expect(css).toContain("--surface-center: #171717");
    expect(css).toContain("--surface-sidebar: #242424");
    expect(css).toContain("--surface-inspector: #2B2B2B");
    expect(css).toContain("--surface-topbar: #181818");
    expect(css).toContain("--surface-elevated: #222222");
    expect(css).toContain("--surface-code: #101010");
    expect(css).toContain("--border-subtle: #343434");
  });

  it("assigns the darkest surface to the work area", () => {
    expect(css).toMatch(/\.app-shell\s*,\s*\.main-column\s*\{[^}]*background: var\(--surface-center\)/s);
    expect(css).toMatch(/\.sidebar\s*\{[^}]*background: var\(--surface-sidebar\)/s);
    expect(css).toMatch(/\.inspector\s*\{[^}]*background: var\(--surface-inspector\)/s);
    expect(css).toMatch(/\.topbar\s*\{[^}]*background: var\(--surface-topbar\)/s);
  });

  it("keeps HTTP Workbench on the shared surface hierarchy", () => {
    expect(css).toContain(".http-workbench-shell { color: var(--text-primary-dark); background: var(--surface-center); }");
    expect(css).toContain(".http-navigator,\n.http-empty-project-rail { color: var(--text-primary-dark); background: var(--surface-sidebar); }");
    expect(css).toContain(".http-chat-column,\n.http-chat-collapsed { background: var(--surface-inspector); }");
    expect(css).toContain(".http-editor { color: var(--text-primary-dark); background: var(--surface-code); }");
  });
});
