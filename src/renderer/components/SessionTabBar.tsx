import type { ProjectSummary } from "../../shared/protocol";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  displayTabTitle,
  modKeyLabel,
  pinShortcutLabel,
  sortTabsPinnedFirst,
  tabShortcutLabel,
  type SessionTab,
} from "../state/sessionTabs";
import { AppIcon } from "./icons";

export interface SessionTabBarProps {
  tabs: SessionTab[];
  activeTabId?: string;
  /** Used to resolve projectId → display name on each tab. */
  projects?: ProjectSummary[];
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOthers?: (tabId: string) => void;
  onCloseToRight?: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
}

function projectLabel(projectId: string, projects: ProjectSummary[]): string {
  const match = projects.find((item) => item.id === projectId || item.path === projectId);
  if (match?.name?.trim()) return match.name.trim();
  const segment = projectId.replace(/\/+$/, "").split("/").pop();
  return segment?.trim() || projectId;
}

function statusClass(status: SessionTab["status"]): string {
  if (status === "running") return "is-running";
  if (status === "awaiting_approval") return "is-waiting";
  if (status === "completed") return "is-completed";
  if (status === "error") return "is-error";
  return "";
}

export function SessionTabBar({
  tabs,
  activeTabId,
  projects = [],
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onTogglePin,
}: SessionTabBarProps) {
  const mod = modKeyLabel();
  const orderedTabs = sortTabsPinnedFirst(tabs);
  const isSingleTab = orderedTabs.length === 1;
  const pinShortcut = pinShortcutLabel(mod);

  return (
    <div className="session-tab-bar" role="tablist" aria-label="Open sessions">
      <div className={`session-tab-scroll ${isSingleTab ? "is-single" : ""}`}>
        {orderedTabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const title = displayTabTitle(tab.title);
          const project = projectLabel(tab.projectId, projects);
          const switchShortcut = tabShortcutLabel(index, mod);
          const pinLabel = tab.pinned ? `Unpin “${title}”` : `Pin “${title}”`;
          const pinControlLabel = isSingleTab ? `${pinLabel} · Shortcut: ${pinShortcut}` : pinLabel;
          const hasOtherTabs = orderedTabs.length > 1;
          const hasTabsToRight = index < orderedTabs.length - 1;
          return (
            <ContextMenu.Root key={tab.id}>
              <ContextMenu.Trigger asChild>
                <div
                  className={`session-tab session-tab--stacked ${active ? "active" : ""} ${tab.pinned ? "is-pinned" : ""} ${tab.isPreview ? "is-preview" : ""}`}
                  role="tab"
                  aria-selected={active}
                  title={[project, title, switchShortcut ? `Switch: ${switchShortcut}` : null]
                    .concat(isSingleTab ? [`Pin: ${pinShortcut}`] : [])
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <button
                    type="button"
                    className={`session-tab-pin ${tab.pinned ? "is-pinned" : ""}`}
                    aria-label={pinControlLabel}
                    title={pinControlLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePin(tab.id);
                    }}
                  >
                    <AppIcon name="pin" size="md" fill={tab.pinned ? "currentColor" : "none"} />
                  </button>
                  {isSingleTab ? (
                    <span className="session-tab-pin-kbd" title={`Pin or unpin tab: ${pinShortcut}`}>
                      {pinShortcut}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="session-tab-main"
                    onClick={() => onActivate(tab.id)}
                  >
                    {statusClass(tab.status) ? (
                      <span className={`session-tab-dot ${statusClass(tab.status)}`} aria-hidden />
                    ) : null}
                    <span className="session-tab-text">
                      <span className="session-tab-project">{project || "Project"}</span>
                      <span className="session-tab-title">{title}</span>
                    </span>
                    {switchShortcut ? (
                      <span className="session-tab-kbd" title={`Switch tab ${switchShortcut}`}>
                        {switchShortcut}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="session-tab-close"
                    aria-label={`Close ${title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(tab.id);
                    }}
                  >
                    <AppIcon name="x" size="xs" />
                  </button>
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="session-context-menu" alignOffset={4}>
                  <ContextMenu.Item className="session-context-item" onSelect={() => onClose(tab.id)}>
                    Close
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className="session-context-item"
                    disabled={!hasOtherTabs}
                    onSelect={() => onCloseOthers?.(tab.id)}
                  >
                    Close other tabs
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className="session-context-item"
                    disabled={!hasTabsToRight}
                    onSelect={() => onCloseToRight?.(tab.id)}
                  >
                    Close tabs to the right
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="session-context-separator" />
                  <ContextMenu.Item className="session-context-item" onSelect={() => onTogglePin(tab.id)}>
                    {tab.pinned ? "Unpin tab" : "Pin tab"}
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          );
        })}
      </div>
    </div>
  );
}
