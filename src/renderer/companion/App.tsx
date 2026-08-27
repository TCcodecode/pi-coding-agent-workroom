import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import type { CSSProperties } from "react";
import { ArrowUp, Maximize2, Minimize2, Plus } from "lucide-react";
import type { FileChangeSummary, ModelOption, PiSnapshot, ProjectSummary, SessionSummary, TimelineItem } from "../../shared/protocol";
import { Markdown } from "../ui/Markdown";
import { createInitialState, type AppState } from "../session/reduce";
import { CompanionClient, snapshotAfter } from "./client";
import { applySnapshot, reduceCompanionEvent } from "./state";
import { CompanionModelPicker } from "./ModelPicker";
import { ProjectPickerButton, ProjectPickerDialog } from "./ProjectPicker";
import { CompanionDiffPreview, formatChangeFile } from "./DiffPreview";
import { readPairingToken, readStoredToken, writeStoredToken } from "./socketUrl";
import {
  CATEGORY_GROUP_LABEL,
  describeTool,
  groupDuration,
  groupTimelineTools,
  timelineDuration,
  toolResultSummary,
  type TimelineEntry,
  type ToolGroup,
  type ToolItem,
} from "../session/toolPresentation";

type Tab = "session" | "changes";

// Layout breakpoints: compact phone vs unfolded foldable vs expand-fold / tablet.
const WIDE_QUERY = "(min-width: 640px)";
const XWIDE_QUERY = "(min-width: 900px)";
const PHONE_QUERY = "(pointer: coarse) and (hover: none)";
const EMPTY_TIMELINE: TimelineItem[] = [];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function collectChanges(state: AppState): FileChangeSummary[] {
  const found = new Map<string, FileChangeSummary>();
  for (const item of state.timeline ?? []) {
    if (item.kind === "tool" && item.change) found.set(item.change.path, item.change);
  }
  for (const call of Object.values(state.toolCalls ?? {})) {
    if (call.change) found.set(call.change.path, call.change);
  }
  return [...found.values()];
}

export function CompanionApp() {
  const [tab, setTab] = useState<Tab>("session");
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [state, setState] = useState<AppState>(createInitialState);
  const [draft, setDraft] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [wideChangesOpen, setWideChangesOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [selectingProjectId, setSelectingProjectId] = useState<string>();
  const [projectError, setProjectError] = useState<string>();
  const [modelError, setModelError] = useState<string>();
  const [branchName, setBranchName] = useState<string>();
  const [collapsedChanges, setCollapsedChanges] = useState<Set<string>>(() => new Set());
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineAutoScrollRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [client] = useState(() => new CompanionClient());
  const isWide = useMediaQuery(WIDE_QUERY);
  const isXWide = useMediaQuery(XWIDE_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const token = useMemo(
    () => readPairingToken(window.location.href) ?? readStoredToken(),
    [],
  );

  useEffect(() => {
    if (!token) {
      setStatus("closed");
      return;
    }
    writeStoredToken(token);
    client.onStatus = setStatus;
    client.onEvent = (event) => setState((current) => reduceCompanionEvent(current, event));
    client.connect(token);
    return () => client.close();
  }, [client, token]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncKeyboardInset = () => {
      // On mobile browsers the keyboard can either resize the layout viewport
      // or overlay it. The visual viewport delta covers the latter without
      // adding extra space when the browser already resized the page.
      setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    syncKeyboardInset();
    viewport.addEventListener("resize", syncKeyboardInset);
    viewport.addEventListener("scroll", syncKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", syncKeyboardInset);
      viewport.removeEventListener("scroll", syncKeyboardInset);
    };
  }, []);

  useEffect(() => {
    if (status !== "open") return;
    void client.request<PiSnapshot>("getSnapshot")
      .then((snapshot) => setState((current) => {
        const next = applySnapshot(snapshot);
        return (next.models ?? []).length > 0 || (current.models ?? []).length === 0
          ? next
          : { ...next, models: current.models };
      }))
      .catch((error) => console.error("[companion] snapshot", error));
  }, [client, status]);

  useEffect(() => {
    if (status !== "open") return;
    let active = true;
    void client.request<ModelOption[]>("getModels")
      .then((models) => {
        if (!active || !Array.isArray(models)) return;
        setState((current) => models.length > 0 || (current.models ?? []).length === 0
          ? { ...current, models }
          : current);
      })
      .catch((error) => console.error("[companion] models", error));
    return () => {
      active = false;
    };
  }, [client, status]);

  const sessionCwd = state.session?.cwd ?? "";
  const sessionId = state.session?.sessionId ?? "";

  useEffect(() => {
    if (status !== "open" || !sessionCwd) {
      setBranchName(undefined);
      return;
    }
    setBranchName(undefined);
    let active = true;
    void client.request<string | undefined>("getGitBranch", [sessionCwd])
      .then((branch) => {
        if (active) setBranchName(typeof branch === "string" && branch.trim() ? branch.trim() : undefined);
      })
      .catch((error) => {
        if (active) setBranchName(undefined);
        console.error("[companion] git branch", error);
      });
    return () => {
      active = false;
    };
  }, [client, sessionCwd, sessionId, status]);

  useEffect(() => {
    if (status !== "open" || !sessionCwd) return;
    void client.request<SessionSummary[]>("listSessions", [sessionCwd])
      .then((sessions) => setState((current) => ({ ...current, sessions: Array.isArray(sessions) ? sessions : [] })))
      .catch((error) => console.error("[companion] sessions", error));
  }, [client, sessionCwd, sessionId, status]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await client.request("prompt", [text]);
    } finally {
      // Keep the text control focused so the mobile keyboard stays available
      // for the next follow-up.
      messageInputRef.current?.focus({ preventScroll: true });
    }
  };

  const focusMessageInput = () => {
    messageInputRef.current?.focus({ preventScroll: true });
  };

  const resizeMessageInput = useCallback(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    const maxHeight = Number.parseFloat(window.getComputedStyle(input).maxHeight) || 128;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeMessageInput();
  }, [draft, resizeMessageInput]);

  useEffect(() => {
    window.addEventListener("resize", resizeMessageInput);
    return () => window.removeEventListener("resize", resizeMessageInput);
  }, [resizeMessageInput]);

  const selectModel = useCallback(async (model: string) => {
    setModelError(undefined);
    try {
      await client.request("setModel", [model]);
      const [provider] = model.split("/");
      setState((current) => ({
        ...current,
        session: { ...current.session, model, provider: provider ?? current.session.provider },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelError(message);
      console.error("[companion] model", error);
    }
  }, [client]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("[companion] fullscreen", error);
    }
  };

  const selectProject = async (projectId: string) => {
    if (selectingProjectId) return;
    setProjectError(undefined);
    setSelectingProjectId(projectId);
    try {
      const result = await client.request("selectProject", [projectId]);
      if (snapshotAfter(result)) {
        const next = applySnapshot(result);
        setState((current) => (next.models ?? []).length > 0 || (current.models ?? []).length === 0
          ? next
          : { ...next, models: current.models });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
      throw error;
    } finally {
      setSelectingProjectId(undefined);
    }
  };

  const changes = collectChanges(state);
  const projects = (state.projects ?? []) as ProjectSummary[];
  const models = useMemo(() => (state.models ?? []) as ModelOption[], [state.models]);
  const availableModels = useMemo(() => models.filter((model) => model.available !== false), [models]);
  const timeline = state.timeline ?? EMPTY_TIMELINE;
  const session = state.session ?? createInitialState().session;
  const activeProject = projects.find((project) => project.id === state.activeProjectId)
    ?? projects.find((project) => project.path === session.cwd);
  const selectedModel = availableModels.find((model) => model.id === session.model) ?? availableModels[0];
  const selectedModelId = selectedModel?.id ?? session.model;
  const activeModelLabel = selectedModel?.label || selectedModel?.id || session.model || "Choose a model";

  useEffect(() => {
    if (status !== "open" || !session.sessionId || session.model || !availableModels[0]) return;
    void selectModel(availableModels[0].id);
  }, [availableModels, selectModel, session.model, session.sessionId, status]);

  const activeProjectPath = activeProject?.path ?? session.cwd;
  const timelineEntries = useMemo(
    () => groupTimelineTools(timeline.filter((item) => item.kind !== "tool" || describeTool(item).category !== "plan")),
    [timeline],
  );

  useEffect(() => {
    timelineAutoScrollRef.current = false;
    setCollapsedChanges(new Set());
    setWideChangesOpen(false);
  }, [sessionId]);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node || timeline.length === 0) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (!timelineAutoScrollRef.current || distanceFromBottom < 180) {
      node.scrollTo({ top: node.scrollHeight, behavior: "auto" });
    }
    timelineAutoScrollRef.current = true;
  }, [sessionId, timeline]);

  const openSession = async (project: ProjectSummary, selectedSession: SessionSummary) => {
    if (!selectedSession.sessionFile) return;
    const result = await client.request("startSession", [{
      cwd: selectedSession.cwd || project.path || activeProjectPath,
      sessionPath: selectedSession.sessionFile,
    }]);
    if (snapshotAfter(result)) {
      const next = applySnapshot(result);
      setState((current) => (next.models ?? []).length > 0 || (current.models ?? []).length === 0
        ? next
        : { ...next, models: current.models });
    }
    setTab("session");
  };

  const loadProjectSessions = async (project: ProjectSummary): Promise<SessionSummary[]> => {
    const sessions = await client.request<SessionSummary[]>("listSessions", [project.path]);
    return Array.isArray(sessions) ? sessions : [];
  };

  // Projects and sessions are selected from the picker above the composer.
  // Phones use a full-width Changes view; non-phone wide screens expand it in
  // the right rail while keeping Chat visible.
  const usesSideChanges = isXWide && !isPhone;
  const mainTab: Tab = usesSideChanges ? "session" : tab;
  const changesOpen = usesSideChanges ? wideChangesOpen : mainTab === "changes";

  useEffect(() => {
    if (changes.length > 0) return;
    if (tab === "changes") setTab("session");
    setWideChangesOpen(false);
  }, [changes.length, tab]);

  const handleViewTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (usesSideChanges) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("textarea, input, button, select, a, [contenteditable=\"true\"]")) return;
    const touch = event.changedTouches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleViewTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (usesSideChanges || !start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx > 0 && mainTab === "session" && changes.length > 0) setTab("changes");
    if (dx < 0 && mainTab === "changes") setTab("session");
  };

  const sessionPanel = (
    <>
      <div ref={timelineRef} className="companion-terminal-timeline">
        {timelineEntries.map((item) => (
          <TimelineRow key={item.id} item={item} />
        ))}
        {timelineEntries.length === 0 && (
          <section className="companion-terminal-welcome" aria-label="PI Desk session ready">
            <span className="companion-terminal-welcome-title">PI Desk</span>
            <div className="companion-terminal-welcome-grid">
              <div className="companion-terminal-welcome-profile">
                <div className="companion-terminal-welcome-content">
                  <h1>Welcome back!</h1>
                  <p className="companion-terminal-welcome-mark" aria-hidden="true">›_</p>
                  <div className="companion-terminal-welcome-context">
                    <p>{activeModelLabel}</p>
                  </div>
                </div>
              </div>
              <div className="companion-terminal-welcome-tips">
                <h2>Tips for getting started</h2>
                <p>Start with a question about this project.</p>
                <p>Use the project menu above the composer to switch sessions.</p>
                <hr />
                <h2>What's new</h2>
                <p>Projects and sessions now live above the composer.</p>
                <p>The Changes panel appears when files change.</p>
              </div>
            </div>
          </section>
        )}
      </div>
      <div className="companion-composer-dock">
        <div className="companion-terminal-toolbar">
          <div className="companion-terminal-project">
            <ProjectPickerButton
              project={activeProject}
              branchName={branchName}
              compact
              disabled={status !== "open" || projects.length === 0}
              onClick={() => setProjectPickerOpen(true)}
            />
          </div>
          <div className="companion-terminal-actions">
            {models.length > 0 && <CompanionModelPicker models={models} value={selectedModelId} disabled={!session.sessionId} onSelect={(model) => void selectModel(model)} />}
            {session.status === "running" && (
              <button type="button" onClick={() => void client.request("abort", [])}>Stop</button>
            )}
          </div>
        </div>
        <form
          className="companion-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
        <textarea
          id="companion-message-input"
          ref={messageInputRef}
          className="companion-text-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onInput={resizeMessageInput}
          onFocus={() => {
            window.requestAnimationFrame(() => {
              messageInputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
            });
          }}
          onKeyDown={(event) => {
            // Do not steal Enter while an IME is
            // committing a candidate into the native textarea.
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="输入消息"
          aria-label="Message"
          inputMode="text"
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="on"
          wrap="soft"
          rows={1}
        />
        {draft.trim() ? (
          <button className="companion-send-button" type="submit" aria-label="Send message" title="Send message">
            <ArrowUp size={21} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="companion-composer-utility"
            aria-label="More input options"
            title="More input options"
            onPointerDown={(event) => {
              event.preventDefault();
              focusMessageInput();
            }}
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        )}
        </form>
      </div>
    </>
  );

  const changesPanel = (
    <div className="companion-list">
      {changes.length === 0 && <p className="companion-empty">No file changes in this session yet.</p>}
      {changes.map((change) => {
        const file = formatChangeFile(change.path, activeProjectPath);
        const expanded = !collapsedChanges.has(change.path);
        return (
          <article className="companion-change-card" key={change.path}>
            <button
              className={`companion-change-header${expanded ? " is-expanded" : ""}`}
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${file.name}`}
              onClick={() => setCollapsedChanges((current) => {
                const next = new Set(current);
                if (next.has(change.path)) next.delete(change.path);
                else next.add(change.path);
                return next;
              })}
            >
              <span className="companion-change-chevron" aria-hidden="true">{expanded ? "⌃" : "›"}</span>
              <span className="companion-change-file" title={change.path}>
                <span className="companion-change-format" aria-label={`File format: ${file.format}`}>{file.format}</span>
                <span className="companion-change-file-copy">
                  <strong className="companion-change-path">{file.name}</strong>
                  {file.directory && <span className="companion-change-directory">{file.directory}/</span>}
                </span>
              </span>
              <span className="companion-change-stats" aria-label={`${change.additions} additions, ${change.deletions} deletions`}>
                <span className="companion-change-additions">+{change.additions}</span>
                <span className="companion-change-deletions">−{change.deletions}</span>
              </span>
            </button>
            {expanded && (
              <div className="companion-change-content">
                <CompanionDiffPreview diff={change.diff} path={change.path} />
                <button
                  className="companion-change-undo"
                  type="button"
                  onClick={() => void client.request("undoFileChange", [change.path])}
                >
                  Undo
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <div
      className={`companion-shell${!isWide ? " is-mobile" : ""}${isWide ? " is-wide" : ""}${isXWide ? " is-xwide" : ""}${isFullscreen ? " is-fullscreen" : ""}${mainTab === "session" ? " is-session" : " is-changes"}`}
      style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
    >
      <div className={`companion-status ${status === "open" ? "" : "is-down"}`}>
        <div className="companion-status-line">
          <strong className="companion-brand">PI Desk</strong>
          <span className="companion-connection-label" aria-label={status === "open" ? "Connected" : "Offline"}>
            <span className="companion-connection-label-text">{status === "open" ? "Connected" : "Offline"}</span>
          </span>
        </div>
        <span className="companion-session-meta">{session.name && session.name !== "?" ? session.name : "Untitled session"}</span>
        {changes.length > 0 && (
          <button
            type="button"
            className="companion-view-toggle"
            onClick={() => {
              if (usesSideChanges) setWideChangesOpen((current) => !current);
              else setTab(mainTab === "changes" ? "session" : "changes");
            }}
            aria-label={changesOpen ? "Hide changes" : "Show changes"}
            title={changesOpen ? "Hide changes" : "Show changes"}
          >
            <span aria-hidden="true">⇆</span>
            <span>{changes.length}</span>
          </button>
        )}
        <button
          type="button"
          className="companion-fullscreen-button"
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        </button>
      </div>
      <div className="companion-body">
        <div
          className={`companion-main${mainTab === "session" ? " companion-session-main" : ""}`}
          onTouchStart={handleViewTouchStart}
          onTouchEnd={handleViewTouchEnd}
        >
          {!token && <p className="companion-empty">Scan the QR code in PI Desk → Settings → Phone.</p>}
          {mainTab === "session" && sessionPanel}
          {mainTab === "changes" && changesPanel}
        </div>

        {(projectError || modelError) && (
          <p className="companion-project-error-banner" role="alert">
            {projectError ? `Project switch failed: ${projectError}` : `Model selection failed: ${modelError}`}
          </p>
        )}

        {usesSideChanges && wideChangesOpen && changes.length > 0 && (
          <aside className="companion-side">
            <div className="companion-side-body">{changesPanel}</div>
          </aside>
        )}
      </div>
      <ProjectPickerDialog
        projects={projects}
        activeProjectId={state.activeProjectId ?? activeProject?.id}
        open={projectPickerOpen}
        externalPendingProjectId={selectingProjectId}
        onClose={() => setProjectPickerOpen(false)}
        onLoadSessions={loadProjectSessions}
        onNewSession={(project) => selectProject(project.id)}
        onOpenSession={openSession}
      />
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineEntry }) {
  if (item.kind === "toolGroup") return <TimelineToolGroup group={item} />;
  if (item.kind === "tool") {
    return <TimelineToolItem item={item} />;
  }
  if (item.kind === "divider") {
    return <p className="companion-terminal-event"><span aria-hidden="true">├</span>{item.label}</p>;
  }
  const isUser = item.kind === "user";
  const label = isUser ? "you" : item.kind === "assistant" ? "pi" : "thinking";
  return (
    <article className={`companion-terminal-turn ${item.kind}`}>
      <span className="companion-terminal-marker" aria-hidden="true">{isUser ? "›" : "●"}</span>
      <div>
        <div className="companion-terminal-author">{label}</div>
        <div className="companion-terminal-content">
          {item.kind === "assistant" || isUser
            ? <Markdown content={item.content} plain={item.status === "streaming"} />
            : item.content}
        </div>
      </div>
    </article>
  );
}

function TimelineToolItem({ item }: { item: ToolItem }) {
  const presentation = describeTool(item);
  const preview = presentation.preview || (item.change ? item.change.path : "");
  const resultSummary = toolResultSummary(item, presentation);
  const duration = timelineDuration(item);
  const label = item.status === "running" && presentation.runningLabel
    ? presentation.runningLabel
    : presentation.label;
  return (
    <p className={`companion-terminal-event companion-terminal-tool-event ${item.status}`}>
      <span className="companion-terminal-tool-marker" aria-hidden="true">│</span>
      <strong className="companion-terminal-tool-label">{label}</strong>
      {preview && <span className="companion-terminal-tool-preview" title={preview}>· {preview}</span>}
      {resultSummary && <span className={`companion-terminal-tool-result${item.status === "error" ? " is-error" : ""}`} title={resultSummary}>{resultSummary}</span>}
      {duration && <span className="companion-terminal-tool-duration">{duration}</span>}
    </p>
  );
}

function TimelineToolGroup({ group }: { group: ToolGroup }) {
  const [expanded, setExpanded] = useState(false);
  const previews = group.items.map((item) => describeTool(item).preview).filter(Boolean) as string[];
  const preview = previews[0];
  const resultSummary = [...group.items]
    .reverse()
    .map((item) => toolResultSummary(item, describeTool(item)))
    .find(Boolean);
  const duration = groupDuration(group.items);
  const detailsId = `companion-tool-group-${group.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className={`companion-terminal-tool-group${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="companion-terminal-tool-toggle"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${CATEGORY_GROUP_LABEL[group.category](group.items.length)}`}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="companion-terminal-tool-marker" aria-hidden="true">│</span>
        <strong className="companion-terminal-tool-label">{CATEGORY_GROUP_LABEL[group.category](group.items.length)}</strong>
        {preview && <span className="companion-terminal-tool-preview" title={preview}>· {preview}</span>}
        {resultSummary && <span className="companion-terminal-tool-result" title={resultSummary}>{resultSummary}</span>}
        {duration && <span className="companion-terminal-tool-duration">{duration}</span>}
        <span className="companion-terminal-tool-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && (
        <div id={detailsId} className="companion-terminal-tool-details">
          {group.items.map((item) => {
            const presentation = describeTool(item);
            const detail = presentation.preview || toolResultSummary(item, presentation) || item.status;
            return (
              <span key={item.id} className="companion-terminal-tool-detail">
                <strong>{presentation.label}</strong>
                <span title={detail}>· {detail}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
