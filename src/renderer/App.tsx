import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer, type ComposerSubmitPayload } from "./components/Composer";
import { collectFileChanges, Timeline } from "./components/Timeline";
import { ChangeInspector } from "./components/ChangeInspector";
import { ResourceInspector } from "./components/ResourceInspector";
import { SessionSidebar } from "./components/SessionSidebar";
import { SessionTabBar } from "./components/SessionTabBar";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { SettingsDialog } from "./components/SettingsDialog";
import { HelpDialog } from "./components/HelpDialog";
import { TreeDialog } from "./components/TreeDialog";
import { HttpWorkbench } from "./components/HttpWorkbench";
import { PlanInspector } from "./components/PlanInspector";
import { AppIcon } from "./components/icons";
import { ShortcutKeys } from "./components/ShortcutKeys";
import { getPiApi } from "./state/piApi";
import { useAppStore } from "./state/appStore";
import type { InspectorTab } from "./components/ResourceInspector";
import type { AgentMode, AgentProfile, LiveSessionSummary, PiEvent, PiSnapshot, SessionModeState, SessionStatus } from "../shared/protocol";
import {
  closeTab as closeTabInList,
  dedupeTabs,
  displayTabTitle,
  ensureInWorkingSet,
  findRestorableTab,
  loadOpenTabs,
  patchTab,
  promotePreviewTab,
  saveOpenTabs,
  sortTabsPinnedFirst,
  type SessionTab,
  togglePinTab,
  touchTab,
  upsertTab,
  WORKING_SET_LIMIT,
} from "./state/sessionTabs";

const SESSION_SCOPED_EVENT_TYPES = new Set<PiEvent["type"]>([
  "session_started",
  "session_completed",
  "session_error",
  "user_message_created",
  "assistant_message_started",
  "assistant_message_delta",
  "assistant_message_completed",
  "thinking_started",
  "thinking_delta",
  "thinking_completed",
  "tool_call_started",
  "tool_call_delta",
  "tool_call_completed",
  "file_change_undone",
  "queue_updated",
  "model_changed",
  "thinking_level_changed",
  "mode_changed",
  "plan_artifact_changed",
  "agent_started",
  "turn_started",
  "turn_completed",
  "compaction_started",
  "compaction_completed",
  "auto_retry_started",
  "auto_retry_completed",
  "model_select",
  "session_name_changed",
  "todos_updated",
]);

type RightPane = "inspector" | "plan" | "changes";
type EditingInterruptedMessage = { messageId: string; text: string } | null;
const EMPTY_INTERRUPTED_MESSAGE_IDS: readonly string[] = [];

function canBePreview(status?: SessionStatus): boolean {
  // A session's persisted history is not evidence that the user has started
  // using it in this working set. Only an active turn makes it non-preview;
  // sending a message promotes it explicitly through promoteTab().
  return status !== "running" && status !== "awaiting_approval";
}

function readPanelWidth(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function defaultChangesWidth(): number {
  const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
  return Math.min(1280, Math.max(520, Math.round(viewport * 0.65)));
}

export function App() {
  const state = useAppStore();
  const api = getPiApi();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => {
    try {
      return localStorage.getItem("pi.motionEnabled") !== "false";
    } catch {
      return true;
    }
  });
  const [rightPane, setRightPane] = useState<RightPane>("inspector");
  const [selectedChangePath, setSelectedChangePath] = useState<string | undefined>();
  const [inspectorWidth, setInspectorWidth] = useState(() => readPanelWidth("pi.inspectorWidth", 300));
  const [planWidth, setPlanWidth] = useState(() => readPanelWidth("pi.planWidth", 420));
  const [changesWidth, setChangesWidth] = useState(() => readPanelWidth("pi.changesWidth", defaultChangesWidth()));
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem("pi.sidebarWidth") ?? 260));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pi.sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    localStorage.setItem("pi.sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem("pi.sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem("pi.inspectorWidth", String(inspectorWidth));
  }, [inspectorWidth]);
  useEffect(() => {
    localStorage.setItem("pi.planWidth", String(planWidth));
  }, [planWidth]);
  useEffect(() => {
    localStorage.setItem("pi.changesWidth", String(changesWidth));
  }, [changesWidth]);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("context");
  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const [branchName, setBranchName] = useState<string | undefined>();
  const [workspaceMode, setWorkspaceMode] = useState<"pi" | "http">(() => {
    try {
      return localStorage.getItem("pi.workspaceMode") === "http" ? "http" : "pi";
    } catch {
      return "pi";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("pi.motionEnabled", String(motionEnabled));
    } catch {
      // Ignore storage failures in restricted/test environments.
    }
    document.documentElement.classList.toggle("motion-disabled", !motionEnabled);
    return () => document.documentElement.classList.remove("motion-disabled");
  }, [motionEnabled]);
  const [openTabs, setOpenTabs] = useState<SessionTab[]>(() => loadOpenTabs().tabs);
  const [activeTabId, setActiveTabId] = useState<string | undefined>(() => loadOpenTabs().activeTabId);
  const [liveSessions, setLiveSessions] = useState<LiveSessionSummary[]>([]);
  const [editingInterruptedMessage, setEditingInterruptedMessage] = useState<EditingInterruptedMessage>(null);
  const [savingInterruptedMessageEdit, setSavingInterruptedMessageEdit] = useState(false);
  const sessionChanges = useMemo(() => collectFileChanges(state.timeline), [state.timeline]);
  const composerHistory = useMemo(
    () => state.timeline.flatMap((item) => (item.kind === "user" ? [item.content] : [])),
    [state.timeline],
  );
  const initialRestoredRef = useRef(false);
  const timelineWrapRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [scrolledFromBottom, setScrolledFromBottom] = useState(false);
  const openTabsRef = useRef(openTabs);
  const activeTabIdRef = useRef(activeTabId);
  const liveSessionsRef = useRef(liveSessions);
  const committedTabIdsRef = useRef(new Set<string>());
  // Each async activation gets a generation. A slower, older request must
  // never replace the session that the user selected more recently.
  const tabActivationRef = useRef(0);
  const requestNewSessionRef = useRef<() => void>(() => undefined);
  openTabsRef.current = openTabs;
  activeTabIdRef.current = activeTabId;
  liveSessionsRef.current = liveSessions;

  const openChanges = useCallback((path?: string) => {
    const selected = path && sessionChanges.some((change) => change.path === path)
      ? path
      : sessionChanges[0]?.path;
    setSelectedChangePath(selected);
    setRightPane("changes");
    setInspectorOpen(true);
  }, [sessionChanges]);

  const activeConversationId = activeTabId ?? state.session.sessionId;
  const interruptedUserMessageIds = useMemo<readonly string[]>(() => {
    if (state.session.status === "running") return EMPTY_INTERRUPTED_MESSAGE_IDS;
    for (let i = state.timeline.length - 1; i >= 0; i -= 1) {
      const item = state.timeline[i];
      if (item.kind === "user") return [item.id];
    }
    return EMPTY_INTERRUPTED_MESSAGE_IDS;
  }, [state.session.status, state.timeline]);

  useEffect(() => {
    setEditingInterruptedMessage(null);
    setSavingInterruptedMessageEdit(false);
  }, [activeConversationId]);

  const copyInterruptedMessage = useCallback(async (item: { content: string }) => {
    try {
      await navigator.clipboard?.writeText(item.content);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const editInterruptedMessage = useCallback((item: { id: string; content: string }) => {
    setEditingInterruptedMessage({ messageId: item.id, text: item.content });
  }, []);

  const formatPromptWithAttachments = useCallback((payload: ComposerSubmitPayload): string => (
    [payload.text.trim(), ...payload.attachments.map((attachment) => `@${attachment.path}`)]
      .filter(Boolean)
      .join("\n")
      .trim()
  ), []);

  const undoChange = useCallback(async (path: string) => {
    if (!api?.undoFileChange) return;
    try {
      const sessionKey = activeTabIdRef.current;
      await api.undoFileChange(path, sessionKey ? { sessionKey } : undefined);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  }, [api]);

  const undoChanges = useCallback(async (paths: string[]) => {
    if (!api?.undoFileChange) return;
    try {
      const sessionKey = activeTabIdRef.current;
      const options = sessionKey ? { sessionKey } : undefined;
      for (const path of paths) await api.undoFileChange(path, options);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  }, [api]);

  const openChangeFile = useCallback(async (path: string) => {
    if (!api?.openFile) return;
    try {
      await api.openFile(path);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  }, [api]);

  const resizeRightPanel = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPane === "changes" ? changesWidth : rightPane === "plan" ? planWidth : inspectorWidth;
    const minWidth = rightPane === "changes" || rightPane === "plan" ? 360 : 280;
    const occupiedSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth + 5;
    const maxWidth = Math.max(minWidth, Math.min(1280, window.innerWidth - occupiedSidebarWidth - 240));
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth - (moveEvent.clientX - startX)));
      if (rightPane === "changes") setChangesWidth(next);
      else if (rightPane === "plan") setPlanWidth(next);
      else setInspectorWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    setSelectedChangePath((current) => current && sessionChanges.some((change) => change.path === current)
      ? current
      : sessionChanges[0]?.path);
  }, [sessionChanges]);

  useEffect(() => {
    saveOpenTabs(openTabs, activeTabId);
  }, [openTabs, activeTabId]);

  // HMR and older app versions can leave duplicate entries in the in-memory
  // list even though new storage loads are clean. Repair it once on mount too.
  useEffect(() => {
    setOpenTabs((tabs) => {
      const deduped = dedupeTabs(tabs, activeTabIdRef.current);
      const nextActiveTabId = deduped.some((tab) => tab.id === activeTabIdRef.current)
        ? activeTabIdRef.current
        : deduped[0]?.id;
      openTabsRef.current = deduped;
      if (nextActiveTabId !== activeTabIdRef.current) {
        activeTabIdRef.current = nextActiveTabId;
        setActiveTabId(nextActiveTabId);
      }
      return deduped;
    });
  }, []);

  // If runtime already has a session but tabs are empty (e.g. tests / cold path), seed a tab.
  useEffect(() => {
    const session = state.session;
    if (!session.sessionId || openTabsRef.current.length > 0) return;
    const projectId =
      state.projects?.find((item) => item.path === session.cwd || item.id === session.cwd)?.id ??
      state.activeProjectId ??
      session.cwd;
    if (!projectId) return;
    const next = upsertTab([], {
      sessionId: session.sessionId,
      sessionFile: session.sessionFile,
      projectId,
      title: session.name || "Untitled",
      status: session.status,
      isPreview: canBePreview(session.status),
    });
    setOpenTabs(next.tabs);
    setActiveTabId(next.activeTabId);
  }, [state.session.sessionId, state.session.sessionFile, state.session.name, state.session.status, state.session.cwd, state.timeline, state.projects, state.activeProjectId]);

  // Follow the conversation to the bottom while new content streams in,
  // unless the user has scrolled up to read older content. Coalesce to the
  // next animation frame so a burst of deltas triggers one layout pass, not one
  // forced reflow per token.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      const wrap = timelineWrapRef.current;
      if (wrap && stickToBottomRef.current) wrap.scrollTop = wrap.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.timeline]);

  const jumpToLatest = useCallback(() => {
    const wrap = timelineWrapRef.current;
    // Do not force stickToBottom here: the streamed rAF re-stick would cut the
    // smooth animation short. Let the scroll settle at the bottom; the scroll
    // event handler then sees atBottom and re-engages stick-to-bottom.
    setScrolledFromBottom(false);
    if (wrap) wrap.scrollTo({ top: wrap.scrollHeight, behavior: "smooth" });
  }, []);

  const patchTabStatus = useCallback((sessionKey: string, status: SessionStatus) => {
    if (status === "running" || status === "awaiting_approval") {
      committedTabIdsRef.current.add(sessionKey);
    }
    setOpenTabs((tabs) => {
      const patched = dedupeTabs(tabs.map((tab) =>
        tab.id === sessionKey
          ? {
              ...tab,
              status,
              isPreview:
                status === "running" || status === "awaiting_approval"
                  ? false
                  : tab.isPreview,
            }
          : tab,
      ), sessionKey);
      openTabsRef.current = patched;
      return patched;
    });
  }, []);

  const promoteTab = useCallback((sessionKey?: string) => {
    const tabId = sessionKey ?? activeTabIdRef.current;
    if (!tabId) return;
    committedTabIdsRef.current.add(tabId);
    setOpenTabs((tabs) => {
      const patched = promotePreviewTab(tabs, tabId);
      openTabsRef.current = patched;
      return patched;
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    let active = true;
    const unsubscribe = api.onEvent((event) => {
      if (event.type === "live_sessions_changed") {
        setLiveSessions(event.payload.sessions);
        return;
      }

      const key = event.sessionKey;
      const isSessionScoped = SESSION_SCOPED_EVENT_TYPES.has(event.type);
      const activeSessionId = useAppStore.getState().session.sessionId;
      const isActiveSession =
        !key ||
        key === activeTabIdRef.current ||
        Boolean(event.sessionId && event.sessionId === activeSessionId);

      if (
        event.type === "user_message_created" ||
        event.type === "agent_started" ||
        event.type === "turn_started"
      ) {
        promoteTab(key);
      }

      // Background live session: update tab status only; do not clobber foreground timeline.
      if (key && isSessionScoped && !isActiveSession) {
        if (event.type === "agent_started" || event.type === "turn_started") {
          patchTabStatus(key, "running");
        } else if (event.type === "turn_completed" || event.type === "session_completed") {
          patchTabStatus(key, event.type === "session_completed" ? "completed" : "idle");
        } else if (event.type === "session_error") {
          patchTabStatus(key, "error");
        } else if (event.type === "session_name_changed") {
          setOpenTabs((tabs) => {
            const patched = dedupeTabs(tabs.map((tab) =>
              tab.id === key
                ? {
                    ...tab,
                    title: event.payload.name || tab.title,
                    sessionId: event.payload.sessionId || tab.sessionId,
                    sessionFile: event.payload.sessionFile || tab.sessionFile,
                  }
                : tab,
            ), key);
            openTabsRef.current = patched;
            return patched;
          });
        }
        // Refresh live list opportunistically when status-ish events arrive.
        void api.listLiveSessions?.().then((list) => {
          if (active) setLiveSessions(list);
        });
        return;
      }

      useAppStore.getState().applyEvent(event);
    });
    void api.getSnapshot().then(async (snapshot) => {
      if (!active) return;
      useAppStore.getState().replaceSnapshot(snapshot);
      const projects = await api.listProjects?.();
      if (projects && active) {
        const activeProjectId = snapshot.activeProjectId ?? projects[0]?.id;
        useAppStore.setState({ projects, activeProjectId });
        const project = projects.find((item) => item.id === activeProjectId);
        if (project && api.listSessions && api.startSession && !initialRestoredRef.current) {
          initialRestoredRef.current = true;
          const list = await api.listSessions(project.path);
          if (!active) return;
          useAppStore.setState({ sessions: list });
          // Prefer restoring last active tab if still valid; else most recent session.
          const saved = loadOpenTabs();
          const preferred =
            findRestorableTab(saved.tabs, saved.activeTabId, project.id, project.path) ??
            (list[0]?.sessionFile
              ? {
                  id: `file:${list[0].sessionFile}`,
                  sessionId: list[0].sessionId,
                  sessionFile: list[0].sessionFile,
                  projectId: project.id,
                  title: list[0].name,
                }
              : undefined);
          if (preferred?.sessionFile) {
            const sessionKey =
              "id" in preferred && preferred.id
                ? preferred.id
                : `file:${preferred.sessionFile}`;
            const snap = await api.startSession({
              cwd: project.path,
              sessionPath: preferred.sessionFile,
              sessionKey,
            });
            if (!active) return;
            applySnapshot(snap);
            const next = ensureInWorkingSet(
              saved.tabs.length ? saved.tabs : [],
              {
                id: sessionKey,
                sessionId: snap.session.sessionId || preferred.sessionId,
                sessionFile: snap.session.sessionFile ?? preferred.sessionFile,
                projectId: project.id,
                title: snap.session.name || preferred.title || "Untitled",
                status: snap.session.status,
                isPreview: canBePreview(snap.session.status),
              },
              sessionKey,
            );
            if (next.ok) {
              setOpenTabs(next.tabs);
              setActiveTabId(next.activeTabId);
              openTabsRef.current = next.tabs;
              activeTabIdRef.current = next.activeTabId;
            }
          }
        }
      }
      if (api.listLiveSessions && active) {
        const live = await api.listLiveSessions();
        if (active) setLiveSessions(live);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [api, promoteTab, patchTabStatus]);

  useEffect(() => {
    void api?.getCommands().then((loaded) => {
      if (loaded.length > 0) setCommands(loaded.map((command) => ({ id: command.id, name: command.name, description: command.description, source: command.source })));
    });
  }, [api, state.session.sessionId]);

  useEffect(() => {
    let active = true;
    const cwd = state.session.cwd;
    if (!cwd || !api?.getGitBranch) {
      setBranchName(undefined);
      return;
    }
    void api.getGitBranch(cwd).then((branch) => {
      if (active) setBranchName(branch);
    });
    return () => {
      active = false;
    };
  }, [api, state.session.cwd, state.session.sessionId]);

  const applySnapshot = (snapshot: PiSnapshot | undefined) => {
    if (!snapshot) return;
    useAppStore.getState().replaceSnapshot(snapshot);
    if (snapshot.projects?.length) {
      useAppStore.setState({
        projects: snapshot.projects,
        activeProjectId: snapshot.activeProjectId ?? snapshot.projects[0]?.id,
      });
    }
  };

  /** Write live session metadata onto the active tab and keep the ref in sync (avoids losing tabs on switch). */
  const commitActiveTabMeta = useCallback((tabId = activeTabIdRef.current) => {
    if (!tabId) return openTabsRef.current;
    const session = useAppStore.getState().session;
    if (!session.sessionId && !session.sessionFile) return openTabsRef.current;
    const committed = openTabsRef.current.map((item) => {
      if (item.id !== tabId) return item;
      const status = session.status ?? item.status;
      const committed =
        item.pinned ||
        committedTabIdsRef.current.has(item.id) ||
        status === "running" ||
        status === "awaiting_approval";
      return {
        ...item,
        sessionId: session.sessionId || item.sessionId,
        sessionFile: session.sessionFile || item.sessionFile,
        title: session.name?.trim() ? session.name : item.title,
        status,
        // History loaded from disk does not mean the user has committed this
        // tab in the current working set. Promotion happens explicitly on
        // send/run, not merely because the session has old messages.
        isPreview: committed ? false : true,
      };
    });
    const deduped = dedupeTabs(committed, tabId);
    openTabsRef.current = deduped;
    setOpenTabs(deduped);
    return deduped;
  }, []);

  /** True when a brand-new tab slot can be admitted (or an existing identity will only focus). */
  const canAdmitTab = useCallback(
    (incoming: { sessionId?: string; sessionFile?: string }) => {
      const tabs = openTabsRef.current;
      const file = incoming.sessionFile?.trim() || "";
      const sessionId = incoming.sessionId?.trim() || "";
      if (file && tabs.some((t) => t.sessionFile === file)) return true;
      if (sessionId && tabs.some((t) => t.sessionId === sessionId)) return true;
      if (tabs.length < WORKING_SET_LIMIT) return true;
      if (tabs.some((t) => !t.pinned)) return true;
      return false;
    },
    [],
  );

  /**
   * Open or focus a tab under the working-set cap (≤9, pin + LRU).
   * Returns active tab id, or undefined if rejected (all 9 pinned).
   */
  const syncTabFromSession = useCallback(
    (snapshot: PiSnapshot, projectId: string, titleHint?: string) => {
      tabActivationRef.current += 1;
      const session = snapshot.session;
      const result = ensureInWorkingSet(
        openTabsRef.current,
        {
          sessionId: session.sessionId,
          sessionFile: session.sessionFile,
          projectId,
          title: displayTabTitle(session.name || titleHint, "Untitled"),
          status: session.status,
          isPreview: canBePreview(session.status),
        },
        activeTabIdRef.current,
      );
      if (!result.ok) {
        pushError(result.message);
        return undefined;
      }
      openTabsRef.current = result.tabs;
      setOpenTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      activeTabIdRef.current = result.activeTabId;
      if (session.status === "running" || session.status === "awaiting_approval") {
        committedTabIdsRef.current.add(result.activeTabId);
      }
      return result.activeTabId;
    },
    [],
  );

  const findLiveSessionForTab = useCallback(
    (tab: SessionTab, live = liveSessionsRef.current): LiveSessionSummary | undefined => {
      if (tab.id) {
        const byKey = live.find((item) => item.sessionKey === tab.id);
        if (byKey) return byKey;
      }
      if (tab.sessionFile) {
        const byFile = live.find((item) => item.sessionFile === tab.sessionFile);
        if (byFile) return byFile;
      }
      const current = useAppStore.getState().session;
      if (
        activeTabIdRef.current === tab.id &&
        current.sessionId &&
        (
          (tab.sessionFile && current.sessionFile && tab.sessionFile === current.sessionFile) ||
          (tab.sessionId && tab.sessionId === current.sessionId) ||
          (!tab.sessionFile && !tab.sessionId)
        )
      ) {
        return {
          sessionKey: tab.id,
          sessionId: current.sessionId,
          sessionFile: current.sessionFile,
          cwd: current.cwd,
          projectId: tab.projectId,
          name: current.name,
          status: current.status,
        };
      }
      return undefined;
    },
    [],
  );

  // Keep active tab title/status aligned with live session (never shrink the tab list).
  useEffect(() => {
    const tabId = activeTabIdRef.current;
    if (!tabId) return;
    const session = state.session;
    const resolvedTitle = displayTabTitle(session.name, "");
    setOpenTabs((tabs) => {
      const current = tabs.find((item) => item.id === tabId);
      if (!current) return tabs;
      const patched = dedupeTabs(tabs.map((item) => {
        if (item.id !== tabId) return item;
        return {
          ...item,
          sessionId: session.sessionId || item.sessionId,
          sessionFile: session.sessionFile || item.sessionFile,
          // Prefer a real session name; keep previous tab title if name is still generic empty.
          title: resolvedTitle || displayTabTitle(item.title),
          status: session.status ?? item.status,
        };
      }), tabId);
      openTabsRef.current = patched;
      return patched;
    });
  }, [state.session.sessionId, state.session.sessionFile, state.session.name, state.session.status]);

  // Sidebar list often has a better display name (first message). Push those into matching tabs.
  useEffect(() => {
    if (!state.sessions?.length) return;
    setOpenTabs((tabs) => {
      let changed = false;
      const patched = tabs.map((tab) => {
        const match = state.sessions.find(
          (item) =>
            (tab.sessionFile && item.sessionFile === tab.sessionFile) ||
            (tab.sessionId && item.sessionId === tab.sessionId),
        );
        const listName = displayTabTitle(match?.name, "");
        if (!listName) return tab;
        const current = displayTabTitle(tab.title, "");
        const currentIsGeneric =
          !current ||
          current === "Untitled" ||
          current === "Untitled session" ||
          current === "New session";
        // Update when tab title is generic, or list name is a clearer non-generic title.
        if (currentIsGeneric && listName !== current) {
          changed = true;
          return { ...tab, title: listName };
        }
        if (!currentIsGeneric && listName !== current && match?.name && match.name === listName) {
          // Explicit rename in catalog should win.
          if (match.name !== tab.title) {
            changed = true;
            return { ...tab, title: listName };
          }
        }
        return tab;
      });
      if (!changed) return tabs;
      openTabsRef.current = patched;
      return patched;
    });
  }, [state.sessions]);

  const activateTab = useCallback(
    async (tabId: string) => {
      // Persist whatever is currently open onto the leaving tab first.
      const tabsAfterCommit = commitActiveTabMeta();
      const tab = tabsAfterCommit.find((item) => item.id === tabId);
      if (!tab) return;
      const activation = ++tabActivationRef.current;
      const previousActiveTabId = activeTabIdRef.current;
      const liveHit = findLiveSessionForTab(tab);
      if (
        tab.id === previousActiveTabId &&
        liveHit &&
        tab.sessionId &&
        tab.sessionId === useAppStore.getState().session.sessionId
      ) {
        const touched = touchTab(tabsAfterCommit, tabId);
        openTabsRef.current = touched;
        setOpenTabs(touched);
        setActiveTabId(tabId);
        activeTabIdRef.current = tabId;
        return;
      }
      // Give the click immediate selected feedback. Metadata was committed
      // above while activeTabIdRef still identified the outgoing tab.
      setActiveTabId(tabId);
      activeTabIdRef.current = tabId;
      try {
        // Multi-runtime: never abort the previous tab's agent on switch.
        const project = useAppStore.getState().projects?.find((item) => item.id === tab.projectId);
        const cwd = project?.path ?? tab.projectId;

        // Prefer explicit session file. Never call newSession on activate — that
        // would replace the tab's conversation and can collapse the tab list.
        let sessionPath = tab.sessionFile;
        if (!sessionPath && tab.sessionId && api?.listSessions) {
          const list = await api.listSessions(cwd);
          sessionPath = list.find((item) => item.sessionId === tab.sessionId)?.sessionFile;
        }

        const nextLiveHit =
          liveHit ??
          (sessionPath
            ? findLiveSessionForTab({ ...tab, sessionFile: sessionPath })
            : undefined);

        let snap: PiSnapshot | undefined;
        if (nextLiveHit && api?.focusSession) {
          snap = await api.focusSession(nextLiveHit.sessionKey);
        } else if (sessionPath) {
          snap = await api?.startSession({ cwd, sessionPath, sessionKey: tabId });
        } else {
          snap = await api?.startSession({ cwd, sessionKey: tabId });
        }
        if (activation !== tabActivationRef.current) return;
        applySnapshot(snap);

        setActiveTabId(tabId);
        activeTabIdRef.current = tabId;
        const state = useAppStore.getState();
        const patched = dedupeTabs(openTabsRef.current.map((item) => {
          if (item.id !== tabId) return item;
          const status = state.session.status ?? item.status;
          const committed =
            item.pinned ||
            committedTabIdsRef.current.has(item.id) ||
            status === "running" ||
            status === "awaiting_approval";
          return {
            ...item,
            sessionId: state.session.sessionId || item.sessionId,
            sessionFile: state.session.sessionFile || item.sessionFile || sessionPath,
            title: state.session.name?.trim() ? state.session.name : item.title,
            status,
            isPreview: committed ? false : true,
          };
        }), tabId);
        const touched = touchTab(patched, tabId);
        openTabsRef.current = touched;
        setOpenTabs(touched);

        if (api?.listLiveSessions) {
          setLiveSessions(await api.listLiveSessions());
        }
      } catch (error) {
        if (activation === tabActivationRef.current && activeTabIdRef.current === tabId) {
          const fallbackTabId = tabsAfterCommit.some((item) => item.id === previousActiveTabId)
            ? previousActiveTabId
            : undefined;
          setActiveTabId(fallbackTabId);
          activeTabIdRef.current = fallbackTabId;
        }
        pushError(error instanceof Error ? error.message : String(error));
      }
    },
    [api, commitActiveTabMeta, findLiveSessionForTab],
  );

  const ensureActiveTabRuntime = useCallback(async (): Promise<string | undefined> => {
    const tabId = activeTabIdRef.current;
    if (!tabId) return undefined;
    const tab = openTabsRef.current.find((item) => item.id === tabId);
    if (!tab) return undefined;
    if (findLiveSessionForTab(tab)) return tabId;
    await activateTab(tabId);
    const refreshed = openTabsRef.current.find((item) => item.id === tabId);
    if (refreshed && findLiveSessionForTab(refreshed)) return tabId;
    if (activeTabIdRef.current === tabId && useAppStore.getState().session.sessionId) return tabId;
    throw new Error("当前会话尚未成功启动，请先激活该标签页后再试。");
  }, [activateTab, findLiveSessionForTab]);

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const wasActive = activeTabIdRef.current === tabId;
      if (wasActive) tabActivationRef.current += 1;
      const result = closeTabInList(openTabsRef.current, tabId, activeTabIdRef.current);
      openTabsRef.current = result.tabs;
      setOpenTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      if (!wasActive) return;
      if (result.activeTabId) {
        // Keep the outgoing identity until activateTab has had a chance to
        // commit it. The closed tab is already absent, so that commit is a
        // no-op instead of copying its metadata onto the neighbor.
        activeTabIdRef.current = tabId;
        await activateTab(result.activeTabId);
        return;
      }
      activeTabIdRef.current = undefined;
      // No tabs left — clear main UI only. Do not abort/dispose solely because the
      // working set is empty (Phase B keeps host runtime alive; Phase A still has
      // a single runtime so the agent may keep occupying it until next start).
      try {
        useAppStore.getState().replaceSnapshot({
          ...useAppStore.getState(),
          session: {
            ...useAppStore.getState().session,
            sessionId: "",
            name: "Untitled session",
            status: "idle",
            sessionFile: undefined,
          },
          timeline: [],
          toolCalls: {},
          queue: { steering: [], followUp: [] },
        });
      } catch {
        // ignore
      }
    },
    [activateTab],
  );

  const handleCloseTabs = useCallback(
    async (tabIds: string[], preferredTabId?: string) => {
      const ids = new Set(tabIds);
      if (ids.size === 0) return;

      const tabsBefore = commitActiveTabMeta();
      const previousActiveId = activeTabIdRef.current;
      if (previousActiveId && ids.has(previousActiveId)) tabActivationRef.current += 1;
      const remaining = tabsBefore.filter((tab) => !ids.has(tab.id));
      let nextActiveId = previousActiveId && !ids.has(previousActiveId) ? previousActiveId : undefined;
      if (!nextActiveId && preferredTabId && remaining.some((tab) => tab.id === preferredTabId)) {
        nextActiveId = preferredTabId;
      }
      if (!nextActiveId && remaining.length > 0) {
        const previousIndex = tabsBefore.findIndex((tab) => tab.id === previousActiveId);
        nextActiveId = remaining[Math.min(Math.max(previousIndex, 0), remaining.length - 1)]?.id;
      }

      openTabsRef.current = remaining;
      setOpenTabs(remaining);
      setActiveTabId(nextActiveId);
      // Keep the old identity until activateTab commits it. Otherwise that
      // commit would accidentally write the old session metadata onto the tab
      // we are about to open.
      activeTabIdRef.current = previousActiveId;

      if (nextActiveId && nextActiveId !== previousActiveId) {
        await activateTab(nextActiveId);
        return;
      }
      if (nextActiveId) return;

      activeTabIdRef.current = undefined;

      try {
        useAppStore.getState().replaceSnapshot({
          ...useAppStore.getState(),
          session: {
            ...useAppStore.getState().session,
            sessionId: "",
            name: "Untitled session",
            status: "idle",
            sessionFile: undefined,
          },
          timeline: [],
          toolCalls: {},
          queue: { steering: [], followUp: [] },
        });
      } catch {
        // ignore
      }
    },
    [activateTab, commitActiveTabMeta],
  );

  const handleTogglePin = useCallback((tabId: string) => {
    const next = togglePinTab(openTabsRef.current, tabId);
    if (next.find((tab) => tab.id === tabId)?.pinned) {
      committedTabIdsRef.current.add(tabId);
    }
    openTabsRef.current = next;
    setOpenTabs(next);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        event.stopPropagation();
        requestNewSessionRef.current();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setInspectorOpen((prev) => !prev);
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === "?" || event.key === "/")) {
        event.preventDefault();
        setHelpOpen((prev) => !prev);
      }
      // ⌘P / Ctrl+P → pin/unpin the active tab (preventDefault blocks browser Print)
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.code === "KeyP" || event.key.toLowerCase() === "p")
      ) {
        const id = activeTabIdRef.current;
        if (id) {
          event.preventDefault();
          event.stopPropagation();
          handleTogglePin(id);
        }
      }
      // ⌘W / Ctrl+W → close (detach) the active session tab.
      // The application menu has no ⌘W accelerator (see main.ts), so this
      // keydown always reaches the renderer and never closes the window.
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "w"
      ) {
        const id = activeTabIdRef.current;
        if (id) {
          event.preventDefault();
          event.stopPropagation();
          void handleCloseTab(id);
        }
      }
      // ⌘1–9 → activate Nth open tab (order = pinned first, then rest)
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        const digit = event.key >= "1" && event.key <= "9" ? Number(event.key) : -1;
        if (digit >= 1) {
          const tab = sortTabsPinnedFirst(openTabsRef.current)[digit - 1];
          if (tab) {
            event.preventDefault();
            void activateTab(tab.id);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateTab, handleCloseTab, handleTogglePin]);

  const pushError = (message: string) => {
    useAppStore.getState().applyEvent({
      eventId: `error-${Date.now()}`,
      workspaceId: "local",
      timestamp: new Date().toISOString(),
      sequence: Date.now(),
      type: "session_error",
      payload: { message },
    });
  };

  /** Open folder → add project → start session. Simple. */
  const openProject = async (): Promise<boolean> => {
    try {
      if (api?.addProject) {
        const snapshot = await api.addProject();
        if (!snapshot) return false;
        applySnapshot(snapshot);
        const projects = await api.listProjects();
        const activeProjectId = snapshot.activeProjectId ?? projects[0]?.id;
        useAppStore.setState({
          projects,
          activeProjectId,
        });
        if (activeProjectId) syncTabFromSession(snapshot, activeProjectId, snapshot.session.name);
        if (snapshot.lastError) pushError(snapshot.lastError);
        return true;
      }
      const cwd = await api?.chooseWorkspace();
      if (!cwd) return false;
      const snap = await api?.startSession({ cwd });
      applySnapshot(snap);
      if (snap) syncTabFromSession(snap, cwd, snap.session.name);
      return true;
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  /** Switch which project is the New-session target — does not load a session. */
  const setActiveProject = async (projectId: string) => {
    try {
      if (api?.setActiveProject) {
        const result = await api.setActiveProject(projectId);
        useAppStore.setState({
          projects: result.projects,
          activeProjectId: result.activeProjectId,
        });
        return;
      }
      // Fallback: local-only highlight if bridge is missing.
      useAppStore.setState({ activeProjectId: projectId });
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  const ensureSession = async (): Promise<boolean> => {
    const { session, projects, activeProjectId } = useAppStore.getState();
    if (session.sessionId) return true;

    const project = projects?.find((p) => p.id === activeProjectId) ?? projects?.[0];
    const cwd = project?.path ?? session.cwd;
    if (!cwd) {
      return openProject();
    }

    try {
      applySnapshot(await api?.startSession({ cwd }));
      return Boolean(useAppStore.getState().session.sessionId);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const handleNewSession = async (projectId: string) => {
    try {
      const project = useAppStore.getState().projects?.find((item) => item.id === projectId);
      if (!project) {
        pushError("Project not found");
        return;
      }
      // Save current conversation onto its tab before opening a new one.
      commitActiveTabMeta();
      const navigation = ++tabActivationRef.current;
      if (!canAdmitTab({})) {
        pushError("Working set full (9 pinned). Unpin a tab to open another.");
        return;
      }
      // Multi-runtime: do not abort other live agents when opening a new session.
      const sessionKey = `tmp:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Reserve working-set slot early so pin-full cannot race.
      const reserved = ensureInWorkingSet(
        openTabsRef.current,
        {
          id: sessionKey,
          sessionId: "",
          projectId: project.id,
          title: "Untitled",
          isPreview: true,
        },
        activeTabIdRef.current,
      );
      if (!reserved.ok) {
        pushError(reserved.message);
        return;
      }
      openTabsRef.current = reserved.tabs;
      setOpenTabs(reserved.tabs);
      setActiveTabId(reserved.activeTabId);
      activeTabIdRef.current = reserved.activeTabId;

      const started = await api?.startSession({ cwd: project.path, sessionKey });
      if (navigation !== tabActivationRef.current) return;
      applySnapshot(started);
      await api?.newSession({ sessionKey });
      if (navigation !== tabActivationRef.current) return;
      const snap = await api?.getSnapshot();
      if (navigation !== tabActivationRef.current) return;
      applySnapshot(snap);
      if (snap) {
        // Patch the reserved tab in place (keep same sessionKey / tab id).
        const patched = patchTab(openTabsRef.current, sessionKey, {
          sessionId: snap.session.sessionId,
          sessionFile: snap.session.sessionFile,
          title: displayTabTitle(snap.session.name, "Untitled"),
          status: snap.session.status,
        });
        const touched = touchTab(patched, sessionKey);
        openTabsRef.current = touched;
        setOpenTabs(touched);
      }
      if (api?.listLiveSessions) setLiveSessions(await api.listLiveSessions());
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Sidebar New session: default to the project you were just in
   * (session cwd → activeProjectId → first project). No project → open folder.
   */
  const requestNewSession = () => {
    const { session, projects, activeProjectId } = useAppStore.getState();
    const fromCwd = session.cwd
      ? projects?.find((item) => item.path === session.cwd || item.id === session.cwd)?.id
      : undefined;
    const projectId = fromCwd ?? activeProjectId ?? projects?.[0]?.id;
    if (projectId) {
      void handleNewSession(projectId);
      return;
    }
    void openProject();
  };
  requestNewSessionRef.current = requestNewSession;

  /**
   * Composer project control: move the chat workspace to another project.
   * Always starts a **new empty** session — never resumes an old session file
   * (that would dump the user into previous history when they only wanted a clean start).
   */
  const switchComposerProject = async (projectId: string) => {
    await handleNewSession(projectId);
  };

  const openSession = async (sessionPath: string, projectId: string, sessionId?: string) => {
    try {
      const project = useAppStore.getState().projects?.find((item) => item.id === projectId);
      const cwd = project?.path ?? projectId;
      if (!sessionPath) {
        pushError("This session has no saved file path");
        return;
      }
      commitActiveTabMeta();
      const navigation = ++tabActivationRef.current;
      const catalogSession = useAppStore.getState().sessions.find(
        (item) => item.sessionFile === sessionPath,
      );
      const requestedSessionId = sessionId?.trim() || catalogSession?.sessionId;
      // Already in working set → just activate (may still switch single runtime).
      const existing = openTabsRef.current.find(
        (item) =>
          item.sessionFile?.trim() === sessionPath.trim() ||
          Boolean(requestedSessionId && item.sessionId === requestedSessionId),
      );
      if (existing) {
        const patched = patchTab(openTabsRef.current, existing.id, {
          sessionId: existing.sessionId || requestedSessionId,
          sessionFile: existing.sessionFile || sessionPath,
        });
        openTabsRef.current = patched;
        setOpenTabs(patched);
        await activateTab(existing.id);
        return;
      }
      if (!canAdmitTab({ sessionFile: sessionPath, sessionId: requestedSessionId })) {
        pushError("Working set full (9 pinned). Unpin a tab to open another.");
        return;
      }
      // Reserve the preview slot before the async host call. This makes the
      // replacement visible immediately instead of leaving the old preview on
      // screen until a historical session finishes loading.
      const sessionKey = `file:${sessionPath}`;
      const reserved = ensureInWorkingSet(
        openTabsRef.current,
        {
          id: sessionKey,
          sessionId: requestedSessionId ?? "",
          sessionFile: sessionPath,
          projectId: project?.id ?? projectId,
          title: displayTabTitle(catalogSession?.name, "Session"),
          status: catalogSession?.status,
          isPreview: canBePreview(catalogSession?.status),
        },
        activeTabIdRef.current,
      );
      if (!reserved.ok) {
        pushError(reserved.message);
        return;
      }
      openTabsRef.current = reserved.tabs;
      setOpenTabs(reserved.tabs);
      setActiveTabId(reserved.activeTabId);
      activeTabIdRef.current = reserved.activeTabId;
      if (
        catalogSession?.status === "running" ||
        catalogSession?.status === "awaiting_approval"
      ) {
        committedTabIdsRef.current.add(reserved.activeTabId);
      }

      const snap = await api?.startSession({ cwd, sessionPath, sessionKey });
      if (navigation !== tabActivationRef.current) return;
      applySnapshot(snap);
      if (snap) {
        const title =
          snap.session.name ||
          useAppStore.getState().sessions.find((item) => item.sessionFile === sessionPath)?.name ||
          "Session";
        const patched = patchTab(openTabsRef.current, sessionKey, {
          sessionId: snap.session.sessionId,
          sessionFile: snap.session.sessionFile ?? sessionPath,
          title: displayTabTitle(title, "Session"),
          status: snap.session.status,
          isPreview: canBePreview(snap.session.status),
        });
        if (
          snap.session.status === "running" ||
          snap.session.status === "awaiting_approval"
        ) {
          committedTabIdsRef.current.add(sessionKey);
        }
        openTabsRef.current = patched;
        setOpenTabs(patched);
      }
      if (api?.listLiveSessions) setLiveSessions(await api.listLiveSessions());
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  const renameSession = async (sessionPath: string, name: string): Promise<string> => {
    if (!api?.renameSession) throw new Error("Rename is not available");
    const result = await api.renameSession(sessionPath, name);
    // Refresh project session list so sidebar + topbar stay aligned after rename.
    const cwd = useAppStore.getState().session.cwd;
    if (cwd && api.listSessions) {
      const list = await api.listSessions(cwd);
      useAppStore.setState({ sessions: list });
    }
    setOpenTabs((tabs) => {
      const patched = tabs.map((tab) =>
        tab.sessionFile === sessionPath ? { ...tab, title: result.name } : tab,
      );
      openTabsRef.current = patched;
      return patched;
    });
    return result.name;
  };

  const deleteSession = async (sessionPath: string, projectId: string): Promise<void> => {
    if (!api?.deleteSession) throw new Error("Delete is not available");
    try {
      const tab = openTabsRef.current.find((item) => item.sessionFile === sessionPath);
      await api.deleteSession(sessionPath);
      // Re-pull snapshot so deleting the active session yields empty main area.
      applySnapshot(await api.getSnapshot());
      const project = useAppStore.getState().projects?.find((item) => item.id === projectId);
      const cwd = project?.path ?? projectId;
      if (cwd && api.listSessions) {
        const list = await api.listSessions(cwd);
        useAppStore.setState({ sessions: list });
      }
      if (tab) await handleCloseTab(tab.id);
      else {
        setOpenTabs((tabs) => {
          const remaining = tabs.filter((item) => item.sessionFile !== sessionPath);
          openTabsRef.current = remaining;
          return remaining;
        });
      }
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  const cloneSession = async (session: { sessionId: string; sessionFile?: string }, projectId: string): Promise<void> => {
    if (!api?.cloneSession) throw new Error("Clone is not available");
    try {
      // Host clone always forks the *current* runtime leaf — open target first if needed.
      if (session.sessionId !== useAppStore.getState().session.sessionId) {
        if (!session.sessionFile) throw new Error("Session has no file path");
        await openSession(session.sessionFile, projectId);
      }
      await api.cloneSession();
      const snap = await api.getSnapshot();
      applySnapshot(snap);
      const project = useAppStore.getState().projects?.find((item) => item.id === projectId);
      const cwd = project?.path ?? useAppStore.getState().session.cwd;
      if (cwd && api.listSessions) {
        const list = await api.listSessions(cwd);
        useAppStore.setState({ sessions: list });
      }
      if (snap) syncTabFromSession(snap, projectId, snap.session.name);
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  const removeProject = async (projectId: string): Promise<void> => {
    if (!api?.removeProject) throw new Error("Remove project is not available");
    try {
      const result = await api.removeProject(projectId);
      useAppStore.setState({
        projects: result.projects,
        activeProjectId: result.activeProjectId,
      });
      // If runtime was disposed, sync empty main state.
      applySnapshot(await api.getSnapshot());
      if (result.activeProjectId && result.activeProjectId !== projectId && api.listSessions) {
        const project = result.projects.find((item) => item.id === result.activeProjectId);
        if (project) {
          const list = await api.listSessions(project.path);
          useAppStore.setState({ sessions: list });
        }
      } else {
        useAppStore.setState({ sessions: [] });
      }
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
    }
  };

  const revealInFolder = (path: string): void => {
    void api?.revealInFolder?.(path);
  };

  const submit = async (payload: ComposerSubmitPayload): Promise<boolean> => {
    if (!api) return false;
    try {
      if (!(await ensureSession())) return false;
      const sessionKey = activeTabIdRef.current ? await ensureActiveTabRuntime() : undefined;
      const mode = useAppStore.getState().session.status === "running" ? "followUp" : "prompt";
      const prompt = formatPromptWithAttachments(payload);
      const resolved = await resolveSessionReferences(prompt);
      if (!resolved) return false;
      const opts = sessionKey ? { sessionKey } : undefined;

      const commandMatch = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(resolved.trim());
      const command = commandMatch
        ? commands.find((item) => item.name.replace(/^\//, "") === commandMatch[1])
        : undefined;
      if (command?.source === "builtin") {
        await api.executeCommand(command.name, commandMatch?.[2] ?? "");
        applySnapshot(await api.getSnapshot());
        setEditingInterruptedMessage(null);
        return true;
      }
      if (command?.source && command.source !== "builtin") {
        // AgentSession.prompt executes registered extension commands immediately
        // and expands /skill:<name> and /<template> commands, including while
        // another turn is streaming. They must not be queued.
        promoteTab(sessionKey);
        await api.prompt(resolved, opts);
        setEditingInterruptedMessage(null);
        return true;
      }

      // Promote synchronously, before the host emits user_message_created, so
      // opening another session immediately after Send cannot replace this tab.
      promoteTab(sessionKey);
      if (mode === "followUp") await api.followUp(resolved, opts);
      else await api.prompt(resolved, opts);
      // Sending marks the active tab as recently used (LRU).
      if (sessionKey) {
        const touched = touchTab(openTabsRef.current, sessionKey);
        openTabsRef.current = touched;
        setOpenTabs(touched);
      }
      setEditingInterruptedMessage(null);
      return true;
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const saveInterruptedMessageEdit = useCallback(async (): Promise<void> => {
    const current = editingInterruptedMessage;
    if (!current || savingInterruptedMessageEdit) return;
    setSavingInterruptedMessageEdit(true);
    try {
      const ok = await submit({ text: current.text, attachments: [] });
      if (!ok) return;
    } finally {
      setSavingInterruptedMessageEdit(false);
    }
  }, [editingInterruptedMessage, savingInterruptedMessageEdit, submit]);

  const editFollowUp = async (index: number, text: string): Promise<boolean> => {
    if (!api?.editFollowUp) return false;
    try {
      if (!(await ensureSession())) return false;
      const sessionKey = activeTabIdRef.current ? await ensureActiveTabRuntime() : undefined;
      const resolved = await resolveSessionReferences(text);
      const expectedText = useAppStore.getState().queue.followUp[index];
      await api.editFollowUp(index, resolved, sessionKey ? { sessionKey } : undefined, expectedText);
      return true;
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const sendFollowUpNow = async (index: number): Promise<boolean> => {
    if (!api?.sendFollowUpNow) return false;
    try {
      if (!(await ensureSession())) return false;
      const sessionKey = activeTabIdRef.current ? await ensureActiveTabRuntime() : undefined;
      const expectedText = useAppStore.getState().queue.followUp[index];
      await api.sendFollowUpNow(index, sessionKey ? { sessionKey } : undefined, expectedText);
      return true;
    } catch (error) {
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const resolveSessionReferences = async (text: string): Promise<string> => {
    const marker = /@session:(\S+)/g;
    let result = text;
    const matches = [...text.matchAll(marker)];
    for (const match of matches) {
      const sessionPath = match[1];
      try {
        const { name, context } = await api!.getSessionContext(sessionPath);
        result = result.replace(match[0], `[referenced session: ${name}]\n${context}`);
      } catch {
        pushError(`Failed to load referenced session: ${sessionPath}`);
        result = result.replace(match[0], "");
      }
    }
    return result.trim();
  };

  const composerProjectId =
    state.projects?.find((p) => p.path === state.session.cwd || p.id === state.session.cwd)?.id ??
    state.activeProjectId;

  const modeState = state.session.modeState ?? {
    mode: "execute" as const,
    planProfile: { thinkingLevel: state.session.thinkingLevel },
    executeProfile: { modelKey: state.session.model || undefined, thinkingLevel: state.session.thinkingLevel },
  };
  const activeMode: AgentMode = modeState.mode;
  const planAvailable = activeMode === "plan" || Boolean(modeState.activePlan);
  const planWorkspaceEditable = activeMode === "plan";
  const sidebarCollapsedBeforePlanRef = useRef(sidebarCollapsed);
  const applyModeState = (next: SessionModeState): void => {
    useAppStore.setState((current) => ({
      session: {
        ...current.session,
        modeState: next,
        model: next.mode === "plan"
          ? next.planProfile.modelKey ?? current.session.model
          : next.executeProfile.modelKey ?? current.session.model,
        thinkingLevel: next.mode === "plan" ? next.planProfile.thinkingLevel : next.executeProfile.thinkingLevel,
      },
    }));
  };
  const currentModeState = (): SessionModeState => {
    const session = useAppStore.getState().session;
    return session.modeState ?? {
      mode: "execute",
      planProfile: { thinkingLevel: session.thinkingLevel },
      executeProfile: { modelKey: session.model || undefined, thinkingLevel: session.thinkingLevel },
    };
  };
  const changeAgentMode = (mode: AgentMode): void => {
    if (!api?.setMode) {
      pushError("当前 Pi Desk 进程尚未加载 Plan/Execute 切换接口，请完全重启应用后再试。");
      return;
    }
    const setMode = api.setMode;
    void (async () => {
      const sessionKey = await ensureActiveTabRuntime();
      const next = await setMode(mode, sessionKey ? { sessionKey } : undefined);
      applyModeState(next);
      // Mode changes alter the active tool policy as well as the model
      // profile. Refresh so Inspector never renders stale tool switches.
      const snapshot = await api.getSnapshot();
      useAppStore.getState().replaceSnapshot(snapshot);
    })().catch((error) => pushError(error instanceof Error ? error.message : String(error)));
  };
  const changeAgentModel = (model: string): void => {
    if (api?.setModeProfile) {
      const setModeProfile = api.setModeProfile;
      void (async () => {
        const sessionKey = await ensureActiveTabRuntime();
        const nextModeState = currentModeState();
        const mode = nextModeState.mode;
        const profile = mode === "plan" ? nextModeState.planProfile : nextModeState.executeProfile;
        const next = await setModeProfile(mode, { ...profile, modelKey: model }, sessionKey ? { sessionKey } : undefined);
        applyModeState(next);
      })().catch((error) => pushError(error instanceof Error ? error.message : String(error)));
    } else {
      pushError("当前 Pi Desk 进程尚未加载模式配置接口，请完全重启应用后再试。");
    }
  };
  const changeAgentThinking = (thinkingLevel: AgentProfile["thinkingLevel"]): void => {
    if (api?.setModeProfile) {
      const setModeProfile = api.setModeProfile;
      void (async () => {
        const sessionKey = await ensureActiveTabRuntime();
        const nextModeState = currentModeState();
        const mode = nextModeState.mode;
        const profile = mode === "plan" ? nextModeState.planProfile : nextModeState.executeProfile;
        const next = await setModeProfile(mode, { ...profile, thinkingLevel }, sessionKey ? { sessionKey } : undefined);
        applyModeState(next);
      })().catch((error) => pushError(error instanceof Error ? error.message : String(error)));
    } else {
      pushError("当前 Pi Desk 进程尚未加载模式配置接口，请完全重启应用后再试。");
    }
  };
  const openPlanReview = (): void => {
    setRightPane("plan");
    setInspectorOpen(true);
  };
  useEffect(() => {
    if (activeMode === "plan") {
      sidebarCollapsedBeforePlanRef.current = sidebarCollapsed;
      setSidebarCollapsed(true);
      return;
    }
    setSidebarCollapsed(sidebarCollapsedBeforePlanRef.current);
  }, [activeMode]);
  useEffect(() => {
    if (activeMode === "plan") openPlanReview();
  }, [activeMode, modeState.activePlan?.id, state.session.sessionId]);
  const projectName =
    state.projects?.find((p) => p.id === composerProjectId)?.name ||
    state.session.cwd?.split("/").pop() ||
    state.projects?.find((p) => p.id === state.activeProjectId)?.name;
  const isNewSessionEmpty = Boolean(projectName && state.session.sessionId);

  const changeWorkspaceMode = (mode: "pi" | "http") => {
    setWorkspaceMode(mode);
    try {
      localStorage.setItem("pi.workspaceMode", mode);
    } catch {
      // Ignore storage failures in restricted/test environments.
    }
  };

  const planConversation = state.timeline.length > 0 ? (
    <Timeline
      items={state.timeline}
      scrollElementRef={timelineWrapRef}
      sessionStatus={state.session.status}
      onReviewChanges={openChanges}
      reviewOpen={inspectorOpen && rightPane === "changes"}
      selectedReviewPath={selectedChangePath}
      onCloseReview={() => setInspectorOpen(false)}
      onUndoChanges={undoChanges}
      interruptedUserMessageIds={interruptedUserMessageIds}
      onCopyInterruptedMessage={copyInterruptedMessage}
      onEditInterruptedMessage={editInterruptedMessage}
      editingInterruptedMessage={editingInterruptedMessage}
      interruptedEditSaving={savingInterruptedMessageEdit}
      onInterruptedMessageTextChange={(text) => setEditingInterruptedMessage((current) => (current ? { ...current, text } : current))}
      onSaveInterruptedMessageEdit={() => void saveInterruptedMessageEdit()}
      onCancelInterruptedMessageEdit={() => setEditingInterruptedMessage(null)}
    />
  ) : undefined;

  const httpAgentChat = (
    <div className="http-agent-chat-shell">
      <div className="http-agent-timeline">
        {state.timeline.length > 0 ? (
          planConversation
        ) : (
          <div className="http-chat-empty"><AppIcon name="messageSquare" size="lg" /><p>Ask the Agent to create, review, or explain a test in this Project.</p></div>
        )}
      </div>
      <Composer
        onSubmit={submit}
        history={composerHistory}
        conversationId={activeConversationId}
        onAbort={() => void api?.abort(activeTabIdRef.current ? { sessionKey: activeTabIdRef.current } : undefined)}
        onPickFile={() => api?.chooseFile() ?? Promise.resolve(undefined)}
        sessions={state.sessions}
        listProjectFiles={(cwd) => api?.listProjectFiles?.(cwd) ?? Promise.resolve([])}
        isRunning={state.session.status === "running"}
        commands={commands}
        queue={state.queue}
        onEditFollowUp={editFollowUp}
        onSendFollowUpNow={sendFollowUpNow}
        models={state.models ?? []}
        model={state.session.model}
        projects={state.projects ?? []}
        projectId={composerProjectId}
        onProjectChange={(projectId) => void switchComposerProject(projectId)}
        onOpenProject={() => void openProject()}
        thinkingLevel={state.session.thinkingLevel}
        mode={activeMode}
        onModeChange={changeAgentMode}
        onModelSelect={changeAgentModel}
        onThinkingLevel={changeAgentThinking}
        workspaceName={projectName}
        workspacePath={state.session.cwd || undefined}
        branchName={branchName}
        placeholder="Ask the Agent about this HTTP test..."
      />
    </div>
  );

  if (workspaceMode === "http") {
    return (
      <HttpWorkbench
        projects={state.projects ?? []}
        activeProjectId={state.activeProjectId}
        onSelectProject={async (projectId) => {
          await setActiveProject(projectId);
          await switchComposerProject(projectId);
        }}
        onOpenProject={() => void openProject()}
        onModeChange={changeWorkspaceMode}
        onNewChat={requestNewSession}
        sidebarWidth={sidebarWidth}
        agentChat={httpAgentChat}
      />
    );
  }

  return (
    <main
      className={`app-shell theme-light ${inspectorOpen ? "with-inspector" : "chat-only"} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${inspectorOpen && rightPane === "changes" ? "changes-open" : ""}`}
      style={{
        "--sidebar-width": `${sidebarWidth}px`,
        "--right-panel-width": activeMode === "plan" && rightPane === "plan"
          ? "70vw"
          : `${rightPane === "changes" ? changesWidth : rightPane === "plan" ? planWidth : inspectorWidth}px`,
      } as React.CSSProperties}
    >
      <SessionSidebar
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={changeWorkspaceMode}
        projects={state.projects ?? []}
        activeProjectId={state.activeProjectId}
        sessions={state.sessions}
        activeSessionId={state.session.sessionId}
        activeSessionStatus={state.session.status}
        liveSessions={liveSessions}
        model={state.session.model}
        thinkingLevel={state.session.thinkingLevel}
        onAddProject={() => void openProject()}
        onRequestNewSession={requestNewSession}
        onNewSession={(projectId) => void handleNewSession(projectId)}
        onSelectProject={(projectId) => void setActiveProject(projectId)}
        onSelectSession={(path, projectId, sessionId) => void openSession(path, projectId, sessionId)}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
        onCloneSession={(session, projectId) => void cloneSession(session, projectId)}
        onRemoveProject={(projectId) => void removeProject(projectId)}
        onRevealInFolder={revealInFolder}
        loadSessions={async (cwd) => (await api?.listSessions?.(cwd)) ?? []}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = sidebarWidth;
          const onMove = (moveEvent: MouseEvent) => {
            const next = Math.min(420, Math.max(200, startWidth + (moveEvent.clientX - startX)));
            setSidebarWidth(next);
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
          document.body.style.cursor = "col-resize";
        }}
      />

      <section className={`main-column ${activeMode === "plan" && rightPane === "plan" ? "plan-focus-main" : ""}`}>
        <header className="topbar topbar-with-tabs">
          <button
            type="button"
            className={`topbar-left-panel-toggle ${sidebarCollapsed ? "is-collapsed" : ""}`}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <AppIcon name="panelLeft" size="md" />
          </button>
          <div className="topbar-tabs">
            <SessionTabBar
              tabs={openTabs}
              activeTabId={activeTabId}
              hideShortcuts={activeMode === "plan" && rightPane === "plan"}
              projects={state.projects ?? []}
              onActivate={(tabId) => void activateTab(tabId)}
              onClose={(tabId) => void handleCloseTab(tabId)}
              onCloseOthers={(tabId) => {
                const ids = openTabsRef.current.filter((tab) => tab.id !== tabId).map((tab) => tab.id);
                void handleCloseTabs(ids, tabId);
              }}
              onCloseToRight={(tabId) => {
                const ordered = sortTabsPinnedFirst(openTabsRef.current);
                const index = ordered.findIndex((tab) => tab.id === tabId);
                if (index < 0) return;
                void handleCloseTabs(ordered.slice(index + 1).map((tab) => tab.id), tabId);
              }}
              onTogglePin={handleTogglePin}
            />
          </div>
          <div className="topbar-side topbar-actions">
            {activeMode === "execute" && modeState.activePlan ? (
              <button
                type="button"
                className="topbar-button plan-return-button"
                aria-label="Open plan"
                title={`Open plan: ${modeState.activePlan.title}`}
                onClick={openPlanReview}
              >
                <AppIcon name="fileText" size="sm" />
                <span>Open plan</span>
              </button>
            ) : null}
            <button
              className="topbar-button shortcut-action-container help-button"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              onClick={() => setHelpOpen(true)}
            >
              <AppIcon name="circleHelp" size="md" />
              {!(activeMode === "plan" && rightPane === "plan") ? <ShortcutKeys className="topbar-kbd" compact keys={["mod", "?"]} /> : null}
            </button>
            <button
              type="button"
              className={`topbar-button shortcut-action-container ${inspectorOpen ? "active" : ""}`}
              aria-label={inspectorOpen ? "Hide right panel" : "Show right panel"}
              title={inspectorOpen ? "Hide right panel" : "Show right panel"}
              onClick={() => setInspectorOpen((open) => !open)}
            >
              <AppIcon name="panelRight" size="md" />
              {!(activeMode === "plan" && rightPane === "plan") ? <ShortcutKeys className="topbar-kbd" compact keys={["mod", "B"]} /> : null}
            </button>
          </div>
        </header>

        <div
          ref={timelineWrapRef}
          className={`timeline-wrap ${state.timeline.length === 0 ? "is-empty" : ""}`}
          onScroll={() => {
            const wrap = timelineWrapRef.current;
            if (!wrap) return;
            const atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 80;
            stickToBottomRef.current = atBottom;
            setScrolledFromBottom(!atBottom);
          }}
        >
          <div className="chat-column">
            {state.timeline.length > 0 ? (
              planConversation
            ) : (
              <div className="welcome-block">
                {!isNewSessionEmpty ? (
                  <div className="welcome-orb"><AppIcon name="messageSquare" size="lg" /></div>
                ) : null}
                <h1>
                  {!projectName
                    ? "Open a project"
                    : state.session.sessionId
                      ? "What are we building?"
                      : "No session open"}
                </h1>
                {!isNewSessionEmpty ? (
                  <>
                    <p className="welcome-copy">
                      {!projectName
                        ? "Use + next to Projects, or Open project… in the chat box."
                        : "Select a session in the sidebar, or create a new one."}
                    </p>
                    {!projectName ? (
                      <button type="button" className="welcome-primary" onClick={() => void openProject()}>
                        Open project
                      </button>
                    ) : (
                      <button type="button" className="welcome-primary" onClick={requestNewSession}>
                        New task
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
          {scrolledFromBottom && state.timeline.length > 0 && (
            <button
              type="button"
              className="timeline-jump-latest"
              aria-label="Jump to latest"
              title="Jump to the latest messages"
              onClick={jumpToLatest}
            >
              <AppIcon name="chevronDown" size="sm" />
              New messages
            </button>
          )}
        </div>

        <div className="composer-dock">
          <div className="chat-column">
            <Composer
              onSubmit={submit}
              history={composerHistory}
              conversationId={activeConversationId}
              onAbort={() =>
                void api?.abort(
                  activeTabIdRef.current ? { sessionKey: activeTabIdRef.current } : undefined,
                )
              }
              onPickFile={() => api?.chooseFile() ?? Promise.resolve(undefined)}
              sessions={state.sessions}
              listProjectFiles={(cwd) => api?.listProjectFiles?.(cwd) ?? Promise.resolve([])}
              isRunning={state.session.status === "running"}
              commands={commands}
              queue={state.queue}
              onEditFollowUp={editFollowUp}
              onSendFollowUpNow={sendFollowUpNow}
              models={state.models ?? []}
              model={state.session.model}
              projects={state.projects ?? []}
              projectId={composerProjectId}
              onProjectChange={(projectId) => void switchComposerProject(projectId)}
              onOpenProject={() => void openProject()}
              thinkingLevel={state.session.thinkingLevel}
              mode={activeMode}
              onModeChange={changeAgentMode}
              onModelSelect={changeAgentModel}
              onThinkingLevel={changeAgentThinking}
              workspaceName={projectName}
              workspacePath={state.session.cwd || undefined}
              branchName={branchName}
            />
          </div>
        </div>
      </section>

      {inspectorOpen && (
        <div
          className="panel-resizer right-panel-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          onMouseDown={resizeRightPanel}
        />
      )}

      {inspectorOpen && (
        rightPane === "changes" ? (
          <ChangeInspector
            changes={sessionChanges}
            selectedPath={selectedChangePath}
            onSelect={setSelectedChangePath}
            onOpenFile={(path) => void openChangeFile(path)}
            onUndo={(path) => void undoChange(path)}
            onOpenInspector={() => setRightPane("inspector")}
            onOpenPlan={planAvailable ? openPlanReview : undefined}
            onClose={() => setInspectorOpen(false)}
          />
        ) : rightPane === "plan" ? (
          <PlanInspector
            api={api}
            sessionId={state.session.sessionId}
            sessionKey={activeTabIdRef.current}
            activePlan={modeState.activePlan}
            editable={planWorkspaceEditable}
            onOpenInspector={() => setRightPane("inspector")}
            onOpenChanges={() => openChanges()}
            onClose={() => setInspectorOpen(false)}
            onError={pushError}
          />
        ) : (
          <ResourceInspector
            session={state.session}
            resources={state.resources}
            tools={state.tools ?? []}
            lockedToolNames={activeMode === "plan" ? ["bash", "edit", "write"] : undefined}
            onToggleTools={(names) => {
              if (!api) return;
              void (async () => {
                const sessionKey = await ensureActiveTabRuntime();
                await api.setTools(names, sessionKey ? { sessionKey } : undefined);
                const snapshot = await api.getSnapshot();
                useAppStore.getState().replaceSnapshot(snapshot);
              })().catch((error) => pushError(error instanceof Error ? error.message : String(error)));
            }}
            onToggleSkills={(patterns) => void api?.setSkills(patterns)}
            onOpenChanges={() => openChanges()}
            onOpenPlan={planAvailable ? openPlanReview : undefined}
            changeCount={sessionChanges.length}
            onClose={() => setInspectorOpen(false)}
            tab={inspectorTab}
            onTabChange={setInspectorTab}
          />
        )
      )}

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
        onSelect={async (command) => {
          setPaletteOpen(false);
          if (command.source && command.source !== "builtin") {
            // Extension, skill, and prompt-template commands are executed by
            // AgentSession.prompt (extension dispatch + /skill: /<template>
            // expansion) — executeCommand has no handler for them.
            await submit({ text: command.name, attachments: [] });
            return;
          }
          await api?.executeCommand(command.name);
          // Reload (and other state-mutating commands) change main-process
          // resources (extensions/skills/prompts). Re-pull the snapshot so
          // the inspector reflects them without an app restart.
          applySnapshot(await api?.getSnapshot());
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        models={state.models ?? []}
        model={state.session.model}
        thinkingLevel={state.session.thinkingLevel}
        onModelSelect={changeAgentModel}
        onThinkingLevel={changeAgentThinking}
        motionEnabled={motionEnabled}
        onMotionEnabledChange={setMotionEnabled}
        onClose={() => setSettingsOpen(false)}
        listProviders={
          api?.listProviders
            ? async () => {
                const rows = await api.listProviders();
                return Array.isArray(rows) ? rows : [];
              }
            : undefined
        }
        loginWithApiKey={api?.loginWithApiKey ? (id, key) => api.loginWithApiKey(id, key) : undefined}
        logoutProvider={api?.logoutProvider ? (id) => api.logoutProvider(id) : undefined}
        loginWithOAuth={api?.loginWithOAuth ? (id) => api.loginWithOAuth(id) : undefined}
        answerAuthPrompt={api?.answerAuthPrompt ? (promptId, answer) => api.answerAuthPrompt(promptId, answer) : undefined}
        cancelProviderLogin={api?.cancelProviderLogin ? (id) => api.cancelProviderLogin(id) : undefined}
        openExternal={api?.openExternal ? (url) => api.openExternal(url) : undefined}
        onProvidersChanged={async () => {
          const nextModels = (await api?.getModels?.()) ?? [];
          useAppStore.setState({ models: nextModels });
        }}
        getMcpConfig={
          api?.getMcpConfig
            ? async () => {
                const view = await api.getMcpConfig();
                return view ?? { cwd: "", sources: [], servers: [] };
              }
            : undefined
        }
        setMcpServerEnabled={api?.setMcpServerEnabled ? (name, enabled) => api.setMcpServerEnabled(name, enabled) : undefined}
        importCursorMcp={api?.importCursorMcp ? () => api.importCursorMcp() : undefined}
        openMcpConfigFile={api?.openMcpConfigFile ? () => api.openMcpConfigFile() : undefined}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} diagnostics={state.diagnostics} />
      <TreeDialog
        open={treeOpen}
        loadTree={async () => (await api?.getSessionTree()) ?? []}
        onFork={(entryId) => {
          setTreeOpen(false);
          void api?.forkSession(entryId);
        }}
        onClose={() => setTreeOpen(false)}
      />
    </main>
  );
}
