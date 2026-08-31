import { AppIcon } from "../ui/icons";
import { ShortcutKeys } from "./ShortcutKeys";
import { SessionTabBar } from "../workspace/SessionTabBar";

/**
 * Main-column top bar: sidebar toggle, session tabs, and the action cluster
 * (help / inspector). Extracted from App.tsx.
 */
export function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
  inspectorOpen,
  onToggleInspector,
  onOpenHelp,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <header className="topbar topbar-with-tabs">
      <button
        type="button"
        className={`topbar-left-panel-toggle ${sidebarCollapsed ? "is-collapsed" : ""}`}
        aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        aria-expanded={!sidebarCollapsed}
        title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggleSidebar}
      >
        <AppIcon name="panelLeft" size="md" />
      </button>
      <div className="topbar-tabs">
        <SessionTabBar />
      </div>
      <div className="topbar-side topbar-actions">
        <button
          className="topbar-button shortcut-action-container help-button"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          onClick={onOpenHelp}
        >
          <AppIcon name="circleHelp" size="md" />
          <ShortcutKeys className="topbar-kbd" compact keys={["mod", "?"]} />
        </button>
        <button
        type="button"
        className={`topbar-button shortcut-action-container ${inspectorOpen ? "active" : ""}`}
        aria-label={inspectorOpen ? "Hide right panel" : "Show right panel"}
        aria-expanded={inspectorOpen}
        title={inspectorOpen ? "Hide right panel" : "Show right panel"}
          onClick={onToggleInspector}
        >
          <AppIcon name="panelRight" size="md" />
          <ShortcutKeys className="topbar-kbd" compact keys={["mod", "B"]} />
        </button>
      </div>
    </header>
  );
}
