import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/renderer/styles.css"), "utf8");

describe("PI Desk light surface hierarchy", () => {
  it("defines the Codex-inspired light depth palette", () => {
    expect(css).toContain("--surface-center: #ffffff");
    expect(css).toContain("--surface-sidebar: #f5f5f5");
    expect(css).toContain("--surface-inspector: #ffffff");
    expect(css).toContain("--surface-topbar: #ffffff");
    expect(css).toContain("--surface-elevated: #ffffff");
    expect(css).toContain("--surface-code: #f7f7f7");
    expect(css).toContain("--border-subtle: #e5e5e5");
    expect(css).toContain("--accent-primary: #202020");
    expect(css).toContain("--warning: #f97316");
    expect(css).toContain("--interaction-hover-surface: #e9e9e9");
    expect(css).toContain("--interaction-selected-surface: #e9e9e9");
    expect(css).toContain("--interaction-focus-ring: 0 0 0 2px rgba(61, 61, 61, .14)");
    expect(css).toContain("color-scheme: light");
  });

  it("assigns the darkest surface to the work area", () => {
    expect(css).toMatch(/\.app-shell\s*\{[^}]*background: var\(--surface-center\)/s);
    expect(css).toContain(".theme-light .sidebar");
    expect(css).toContain(".theme-light .inspector");
    expect(css).toContain(".theme-light .topbar");
  });

  it("keeps HTTP Workbench on the shared surface hierarchy", () => {
    expect(css).toContain(".http-workbench-shell { color: var(--text-primary-dark); background: var(--surface-center); }");
    expect(css).toContain(".http-navigator,\n.http-empty-project-rail { color: var(--text-primary-dark); background: var(--surface-sidebar); }");
    expect(css).toContain(".http-chat-column,\n.http-chat-collapsed { background: var(--surface-inspector); }");
    expect(css).toContain(".http-editor { color: var(--text-primary-dark); background: var(--surface-code); }");
    expect(css).toContain(".http-workbench-shell.theme-light");
  });

  it("separates black primary actions from neutral navigation and index controls", () => {
    expect(css).toContain(".theme-light .send-button");
    expect(css).toContain("background: #202020");
    expect(css).toContain(".theme-light .mode-switcher button.is-active");
    expect(css).toContain("background: #ffea88");
    expect(css).toContain(".theme-light .index-btn");
    expect(css).toContain(".theme-light .index-search-btn");
    expect(css).toContain("background: #f7f7f7");
  });

  it("keeps chat bubbles and the composer neutral in daylight mode", () => {
    expect(css).toContain(".theme-light .timeline-item.message-item.user .message-content");
    expect(css).toContain("background: #f1f1f1");
    expect(css).toContain(".theme-light .send-button");
    expect(css).toContain("border-radius: 50%");
    expect(css).toContain(".theme-light .composer-card:focus-within");
    expect(css).toMatch(/\.theme-light \.composer-card\s*\{\s*padding-bottom: 8px;\s*\}/s);
    expect(css).toMatch(
      /\.theme-light \.topbar-button,[\s\S]*\.theme-light \.topbar-button\.active:hover\s*\{[^}]*color: var\(--text-secondary\);[^}]*background: transparent/s,
    );
    expect(css).toMatch(
      /\.theme-light \.topbar-button:active,[\s\S]*\.theme-light \.topbar-button\.active:focus-visible\s*\{[^}]*background: transparent[^}]*box-shadow: none[^}]*transform: none/s,
    );
    expect(css).toMatch(
      /\.theme-light \.topbar-button\.active,[\s\S]*\.theme-light \.topbar-button\.active:focus-visible\s*\{[^}]*color: var\(--text-primary\)[^}]*background: #e9e9e9[^}]*box-shadow: none/s,
    );
    expect(css).toMatch(/\.theme-light \.topbar-button \.topbar-kbd,[\s\S]*background: transparent/s);
    expect(css).toMatch(
      /\.theme-light \.composer-card \.ctrl-box,[\s\S]*\.theme-light \.composer-card \.composer-context-control\s*\{[^}]*border-color: transparent[^}]*background: transparent/s,
    );
    expect(css).toMatch(
      /\.theme-light \.composer-card \.ctrl-box:hover,[\s\S]*\.theme-light \.composer-card \.composer-context-control:hover\s*\{[^}]*background: var\(--surface-hover\)/s,
    );
  });

  it("gives daylight dialogs a hairline border and soft shadow", () => {
    expect(css).toContain(".theme-light .settings-dialog,");
    expect(css).toContain("border-width: 1px");
    expect(css).toContain("box-shadow: 0 8px 24px rgba(0, 0, 0, .08)");
    expect(css).toContain(".theme-light .mode-switcher button,");
    expect(css).toContain("font-weight: 500");
  });

  it("keeps project selection hover-based while the open session stays selected", () => {
    expect(css).toContain(".theme-light .project-node-row:hover");
    expect(css).toContain(".theme-light .project-node.active .project-node-toggle");
    expect(css).toContain(".theme-light .project-node.active .project-node-row");
    expect(css).toContain(".theme-light .session-item.nested.active");
    expect(css).toContain(".theme-light .project-session-list");
    expect(css).toContain("margin-top: 4px");
    expect(css).toContain(".theme-light .project-node-row:hover");
    expect(css).not.toContain(".theme-light .project-node:hover > .project-node-row");
    expect(css).toContain("background: #e9e9e9");
    expect(css).toContain(".theme-light .session-item.nested:hover,");
    expect(css).toContain(".theme-light .composer-hints");
    expect(css).toMatch(/\.theme-light \.composer-hints\s*\{\s*color: #3d3d3d;\s*font-weight: 400;\s*\}/s);
    expect(css).toContain(".theme-light .sidebar-user-label");
    expect(css).toMatch(/\.sidebar-user-label\s*\{[^}]*font-weight: 400/s);
    expect(css).toMatch(/\.theme-light \.project-node-name\s*\{\s*font-weight: 400;\s*\}/s);
    expect(css).toMatch(/\.theme-light \.sidebar-section-head\s*\{\s*color: #7d7d7d;\s*font-size: 12px;\s*font-weight: 600;\s*text-transform: none;\s*\}/s);
    expect(css).toContain("--sidebar-leading-inset: 8px");
    expect(css).toContain("--sidebar-leading-gap: 6px");
    expect(css).toContain("--sidebar-leading-icon-slot: 16px");
    expect(css).toContain("--sidebar-selection-inset: 8px");
    expect(css).toContain("--sidebar-selection-gap: 4px");
    expect(css).toMatch(/\.sidebar-leading-control\s*\{\s*gap: var\(--sidebar-leading-gap\);\s*padding-left: var\(--sidebar-leading-inset\);\s*padding-right: var\(--sidebar-leading-inset\);\s*\}/s);
    expect(css).toMatch(/\.theme-light \.context-bar-track\s*\{\s*background: var\(--surface-active\);\s*\}/s);
    expect(css).toMatch(
      /\.theme-light \.project-session-list\s*\{[^}]*gap: var\(--sidebar-selection-gap\)[^}]*padding: 0 0 2px/s,
    );
    expect(css).toMatch(/\.theme-light \.project-tree\s*\{\s*padding-left: var\(--sidebar-selection-inset\);\s*\}/s);
    expect(css).toMatch(/\.theme-light \.session-item\.nested\s*\{[^}]*width: 100%[^}]*padding-left: 20px/s);
  });

  it("uses one neutral hover and selection surface across navigation and settings", () => {
    expect(css).toContain(".theme-light .settings-tab:hover,");
    expect(css).toContain(".theme-light .settings-tab.active,");
    expect(css).toContain(".theme-light .session-item.nested:hover,");
    expect(css).toContain(".theme-light .sidebar-user:hover,");
    expect(css).toMatch(
      /\.theme-light \.project-node-row:hover \.project-node-toggle,\s*\.theme-light \.project-node-row:hover \.sidebar-icon-btn\s*\{\s*color: inherit;\s*background: transparent;\s*\}/s,
    );
    expect(css).not.toContain(
      ".theme-light .project-node-row:hover,\n.theme-light .project-node-row:hover .project-node-toggle,",
    );
    expect(css).toMatch(
      /\.theme-light \.project-node-row:hover,\s*\.theme-light \.project-node\.active \.project-node-row:hover\s*\{\s*color: var\(--text-primary\);\s*background: var\(--interaction-hover-surface\);\s*\}/s,
    );
    expect(css).toContain("background: var(--interaction-hover-surface);");
    expect(css).toContain("background: var(--interaction-selected-surface);");
    expect(css).toContain(".theme-light .settings-oauth-option:has(input:checked)");
    expect(css).toMatch(
      /\.theme-light \.session-item-delete:hover,\s*\.theme-light \.session-item-delete:focus-visible\s*\{\s*color: #b54740;\s*background: transparent;\s*\}/s,
    );
  });

  it("routes right-pane interactions through the shared neutral contract", () => {
    expect(css).toContain(".theme-light .inspector .right-pane-mode-tabs button:hover,");
    expect(css).toContain(".theme-light .inspector .change-tree-file:hover,");
    expect(css).toContain(".theme-light .inspector .right-pane-mode-tabs button.selected,");
    expect(css).toContain(".theme-light .inspector .change-tree-file.selected");
    expect(css).toContain(".theme-light .inspector .inspector-header-actions .icon-button:focus-visible");
    expect(css).toMatch(
      /\.theme-light \.inspector \.right-pane-mode-tabs button\.selected,[\s\S]*background: var\(--interaction-selected-surface\)/s,
    );
    expect(css).toMatch(
      /\.theme-light \.inspector \.right-pane-mode-tabs button:hover,[\s\S]*background: var\(--interaction-hover-surface\)/s,
    );
  });

  it("keeps right-pane status colors semantic and indicator-only", () => {
    expect(css).toContain("--right-pane-content-padding: var(--space-4)");
    expect(css).toContain("--right-pane-row-height: 28px");
    expect(css).toContain(".theme-light .todo-active,");
    expect(css).toContain(".theme-light .mcp-status-label.cached { color: var(--info); background-color: transparent; }");
    expect(css).toContain(".theme-light .resource-icon.failed,");
    expect(css).toContain(".theme-light .mcp-status-label.failed { color: var(--danger); background-color: transparent; }");
    expect(css).toMatch(/\.theme-light \.status-dot\.running\s*\{[\s\S]*background: var\(--status-running\)/s);
    expect(css).toMatch(/\.theme-light \.status-dot\.idle\s*\{[\s\S]*background: var\(--status-idle\)/s);
  });

  it("keeps Inspector and Changes on the same content and control rhythm", () => {
    expect(css).toMatch(
      /\.theme-light \.inspector-content,[\s\S]*\.theme-light \.changes-inspector-content\s*\{[\s\S]*padding: var\(--right-pane-content-padding\) var\(--right-pane-content-padding\) var\(--right-pane-content-bottom\)/s,
    );
    expect(css).toMatch(
      /\.theme-light \.changes-inspector \.change-inspector-section-heading\s*\{[\s\S]*font-size: var\(--text-sm\)[\s\S]*line-height: var\(--leading-sm\)/s,
    );
    expect(css).toMatch(
      /\.theme-light \.changes-inspector \.change-collapse-button,[\s\S]*\.theme-light \.changes-inspector \.change-undo-button\s*\{[\s\S]*min-height: var\(--control-height-compact\)[\s\S]*border-radius: var\(--radius-sm\)/s,
    );
  });

  it("uses the indigo accent for Inspector switches", () => {
    expect(css).toContain("--inspector-switch-accent: #319DFF");
    expect(css).toMatch(
      /\.theme-light \.inspector \.tool-toggle-row:has\(\.inspector-switch-input:checked\) \.inspector-switch,[\s\S]*background: var\(--inspector-switch-accent\);/s,
    );
    expect(css).not.toContain(".tool-toggle-row:hover .inspector-switch");
    expect(css).not.toContain(".skill-group-heading:hover .inspector-switch");
    expect(css).not.toContain(".skill-toggle-row:hover .inspector-switch");
  });

  it("styles change summaries as light Codex cards", () => {
    expect(css).toContain(".theme-light .change-summary");
    expect(css).toContain("border-color: #dedede");
    expect(css).toContain("background: #f6f6f6");
    expect(css).toContain(".theme-light .change-summary-review");
    expect(css).toContain("background: #ffffff");
    expect(css).toContain(".theme-light .change-summary-file:hover");
    expect(css).toContain("background: #f0f0f0");
    expect(css).toContain(".theme-light .change-summary-files.is-single-file .change-summary-file");
    expect(css).toContain("width: 100%");
    expect(css).toContain("background: #ffffff");
    expect(css).toContain("max-width: 100%");
  });
});
