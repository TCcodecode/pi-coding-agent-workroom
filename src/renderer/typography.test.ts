import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TYPOGRAPHY_FONT_FAMILIES, TYPOGRAPHY_SCALE } from "./typography";

describe("typography tokens", () => {
  it("uses bundled UI and mono families with a readable minimum scale", () => {
    expect(TYPOGRAPHY_FONT_FAMILIES.ui).toContain("Inter");
    expect(TYPOGRAPHY_FONT_FAMILIES.mono).toContain("IBM Plex Mono");
    expect(TYPOGRAPHY_SCALE.ui.px).toBe(12);
    expect(TYPOGRAPHY_SCALE.body.px).toBe(13);
    expect(TYPOGRAPHY_SCALE.message.px).toBe(13.5);
    expect(TYPOGRAPHY_SCALE.compact.px).toBeGreaterThanOrEqual(10);
  });

  it("defines semantic font tokens and avoids the old tiny shortcut hint", () => {
    const css = readFileSync(resolve(process.cwd(), "src/renderer/styles.css"), "utf8");

    expect(css).toContain("--font-ui");
    expect(css).toContain("--font-mono");
    expect(css).toContain("font-family: var(--font-mono)");
    expect(css).toMatch(/\.topbar-kbd\s*\{[^}]*height: 20px/s);
    expect(css).toMatch(/\.topbar-kbd\s*\{[^}]*border: 1px solid #31353f/s);
    expect(css).toMatch(/\.topbar-kbd(?:\.shortcut-keys--compact)?\s+kbd\s*\{[^}]*font-size: var\(--text-sm\)/s);
    expect(css).toMatch(/\.topbar-kbd\.shortcut-keys--compact kbd\[data-shortcut-key="mod"\]\s*\{[^}]*font-size: 13px/s);
    expect(css).not.toContain('.topbar-kbd { color: #484d58; font-size: 9px');
  });
});
