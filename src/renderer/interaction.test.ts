import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/renderer/styles.css"), "utf8");

describe("PI Desk interaction language", () => {
  it("defines a shared control and motion scale", () => {
    expect(css).toContain("--control-height: 32px");
    expect(css).toContain("--control-height-compact: 28px");
    expect(css).toContain("--control-radius: 8px");
    expect(css).toContain("--focus-ring: 0 0 0 1px rgba(255, 255, 255, .12), 0 4px 16px rgba(0, 0, 0, .32)");
    expect(css).toContain("--transition-fast: 120ms ease");
    expect(css).toContain("--transition-normal: 180ms ease");
  });

  it("gives keyboard users a consistent visible focus state", () => {
    expect(css).toMatch(
      /button:focus-visible,\s*select:focus-visible,\s*\[role="button"\]:focus-visible\s*\{[^}]*box-shadow: var\(--focus-ring\)/s,
    );
  });

  it("uses the shared control rhythm in the composer", () => {
    expect(css).toMatch(
      /\.ctrl-box,\s*\.composer-menu-control,\s*\.composer-context-control\s*\{[^}]*min-height: var\(--control-height\)[^}]*border-radius: var\(--control-radius\)/s,
    );
    expect(css).toMatch(/\.send-button\s*\{[^}]*transition:[^}]*var\(--transition-fast\)/s);
    expect(css).toMatch(/\.send-button:active\s*\{[^}]*transform: translateY\(1px\)/s);
  });

  it("respects reduced-motion preferences", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{/);
  });

  it("keeps the composer frame while flattening its secondary controls", () => {
    expect(css).toMatch(/\.composer-card\s*\{[^}]*border: 1px solid/s);
    expect(css).toMatch(
      /\.composer-card \.ctrl-box,\s*\.composer-card \.composer-menu-control,\s*\.composer-card \.composer-context-control\s*\{[^}]*border-color: transparent[^}]*background: transparent/s,
    );
    expect(css).toMatch(
      /\.composer-card \.ctrl-box:hover,[\s\S]*\.composer-card \.composer-context-control:hover\s*\{[^}]*background: #292a2d/s,
    );
  });

  it("uses an inset white capsule instead of an underline or outer halo for the active session tab", () => {
    expect(css).toMatch(
      /\.theme-light \.session-tab\.session-tab--stacked\.active,[\s\S]*?border-color: #d7d7d7[\s\S]*?background: #ffffff[\s\S]*?box-shadow: 0 1px 2px rgba\(0, 0, 0, \.045\)/,
    );
    expect(css).not.toContain("0 0 0 3px rgba(0, 0, 0, .08)");
  });

  it("uses one shared recessed rail for compact, single-line session tabs", () => {
    expect(css).toMatch(
      /\.theme-light \.session-tab-scroll\s*\{[^}]*height: 30px[^}]*padding: 2px[^}]*border-radius: 15px[^}]*background: #e6e6e6/s,
    );
    expect(css).toMatch(
      /\.theme-light \.session-tab\.session-tab--stacked\s*\{[^}]*min-height: 26px[^}]*border-radius: 13px[^}]*background: transparent/s,
    );
    expect(css).toMatch(
      /\.theme-light \.session-tab\.session-tab--stacked \.session-tab-project\s*\{\s*display: none/s,
    );
  });
});
