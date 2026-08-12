import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ModelOption,
  ProjectFileEntry,
  ProjectSummary,
  SessionSummary,
  ThinkingLevel,
  AgentMode,
} from "../../shared/protocol";
import { ModelSelector } from "./ModelSelector";
import { ControlBox } from "./ControlBox";
import { ComposerMenu } from "./ComposerMenu";
import { CommandPicker, filterPaletteCommands } from "./CommandPalette";
import type { PaletteCommand } from "./commandTypes";
import { AppIcon } from "./icons";

const DEFAULT_THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export interface ComposerProps {
  onSubmit: (text: string) => Promise<boolean>;
  onAbort: () => void;
  onPickFile: () => Promise<string | undefined>;
  /** Previously submitted user messages from the active conversation. */
  history?: string[];
  /** Resets input navigation when the active conversation changes. */
  conversationId?: string;
  commands?: PaletteCommand[];
  sessions?: SessionSummary[];
  listProjectFiles?: (cwd?: string) => Promise<ProjectFileEntry[]>;
  isRunning: boolean;
  queue: { steering: string[]; followUp: string[] };
  onEditFollowUp?: (index: number, text: string) => Promise<boolean>;
  onSendFollowUpNow?: (index: number) => Promise<boolean>;
  models?: ModelOption[];
  model?: string;
  thinkingLevel?: ThinkingLevel;
  mode?: AgentMode;
  onModelSelect?: (model: string) => void;
  onThinkingLevel?: (level: ThinkingLevel) => void;
  onModeChange?: (mode: AgentMode) => void;
  workspaceName?: string;
  workspacePath?: string;
  branchName?: string;
  /** Projects available in the composer project control. */
  projects?: ProjectSummary[];
  /** Currently selected project id (cwd / catalog id). */
  projectId?: string;
  /** User picked another existing project from the composer control. */
  onProjectChange?: (projectId: string) => void;
  /** User chose “Open project…” from the composer control. */
  onOpenProject?: () => void;
  /** Optional context-specific input placeholder. */
  placeholder?: string;
}

export function Composer({
  onSubmit,
  onAbort,
  onPickFile,
  history = [],
  conversationId,
  commands = [],
  sessions = [],
  listProjectFiles,
  isRunning,
  queue,
  onEditFollowUp,
  onSendFollowUpNow,
  models = [],
  model = "",
  thinkingLevel = "medium",
  mode = "execute",
  onModelSelect,
  onThinkingLevel,
  onModeChange,
  workspaceName,
  workspacePath,
  branchName,
  projects = [],
  projectId,
  onProjectChange,
  onOpenProject,
  placeholder,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [submittedHistory, setSubmittedHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sending, setSending] = useState(false);
  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [editingQueueText, setEditingQueueText] = useState("");
  const [queueActionIndex, setQueueActionIndex] = useState<number | null>(null);
  const [atQuery, setAtQuery] = useState("");
  const [atPickerOpen, setAtPickerOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandPickerOpen, setCommandPickerOpen] = useState(false);
  const [commandHighlighted, setCommandHighlighted] = useState(0);
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyDraftRef = useRef("");
  const historyCaretRef = useRef<number | null>(null);
  const atCaretRef = useRef(0);
  const commandTokenRef = useRef<{ start: number; end: number; query: string } | null>(null);
  const commandCaretRef = useRef<number | null>(null);

  const historyEntries = useMemo(() => {
    const persisted = history.filter((item) => item.trim().length > 0);
    if (submittedHistory.length === 0) return persisted;

    // The runtime normally echoes submitted messages into `history`. Keep the
    // local copy only until that echo arrives so Up works without a round trip.
    const echoedStart = persisted.length - submittedHistory.length;
    const echoed =
      echoedStart >= 0 &&
      submittedHistory.every((item, index) => persisted[echoedStart + index] === item);
    return echoed ? persisted : [...persisted, ...submittedHistory];
  }, [history, submittedHistory]);

  const availableModels = useMemo(() => models.filter((item) => item.available), [models]);
  const resolvedModel = useMemo(() => {
    if (availableModels.some((item) => item.id === model)) return model;
    return availableModels[0]?.id ?? "";
  }, [availableModels, model]);

  const thinkingLevels = useMemo(() => {
    const selected = availableModels.find((item) => item.id === resolvedModel);
    if (selected?.thinkingLevels?.length) return selected.thinkingLevels;
    return DEFAULT_THINKING_LEVELS;
  }, [availableModels, resolvedModel]);

  const filteredCommands = useMemo(
    () => filterPaletteCommands(commands, commandQuery).slice(0, 8),
    [commands, commandQuery],
  );

  useEffect(() => {
    if (editingQueueIndex !== null && editingQueueIndex >= queue.followUp.length) {
      setEditingQueueIndex(null);
      setEditingQueueText("");
    }
  }, [editingQueueIndex, queue.followUp.length]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    // Clear optimistically so the box never keeps sent text while the agent
    // runs; restore only when the send is rejected before starting.
    const snapshot = text;
    setText("");
    try {
      const sent = await onSubmit(value);
      if (!sent) {
        setText(snapshot);
      } else {
        setSubmittedHistory((current) => [...current, value]);
        setHistoryIndex(-1);
        historyDraftRef.current = "";
      }
    } catch {
      setText(snapshot);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    setSubmittedHistory([]);
    setHistoryIndex(-1);
    historyDraftRef.current = "";
  }, [conversationId]);

  useEffect(() => {
    if (historyIndex >= historyEntries.length) setHistoryIndex(-1);
  }, [historyEntries.length, historyIndex]);

  useEffect(() => {
    const caret = historyCaretRef.current;
    if (caret === null) return;
    textareaRef.current?.setSelectionRange(caret, caret);
    historyCaretRef.current = null;
  }, [text]);

  const navigateHistory = (direction: "up" | "down"): boolean => {
    if (historyEntries.length === 0) return false;
    const input = textareaRef.current;
    const caret = input?.selectionStart ?? text.length;
    const isBrowsing = historyIndex >= 0;
    const atBoundary =
      text.length === 0 ||
      (direction === "up" ? caret === 0 : caret === text.length);
    if (!isBrowsing && !atBoundary) return false;

    if (direction === "up") {
      if (!isBrowsing) historyDraftRef.current = text;
      const nextIndex = isBrowsing ? Math.max(historyIndex - 1, 0) : historyEntries.length - 1;
      setHistoryIndex(nextIndex);
      const nextText = historyEntries[nextIndex] ?? "";
      historyCaretRef.current = nextText.length;
      setText(nextText);
      return true;
    }

    if (!isBrowsing) return false;
    if (historyIndex < historyEntries.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const nextText = historyEntries[nextIndex] ?? "";
      historyCaretRef.current = nextText.length;
      setText(nextText);
      return true;
    }

    setHistoryIndex(-1);
    const draft = historyDraftRef.current;
    historyDraftRef.current = "";
    historyCaretRef.current = draft.length;
    setText(draft);
    return true;
  };

  const beginQueueEdit = (index: number) => {
    setEditingQueueIndex(index);
    setEditingQueueText(queue.followUp[index] ?? "");
  };

  const cancelQueueEdit = () => {
    setEditingQueueIndex(null);
    setEditingQueueText("");
  };

  const saveQueueEdit = async () => {
    if (editingQueueIndex === null || !onEditFollowUp || !editingQueueText.trim()) return;
    const index = editingQueueIndex;
    setQueueActionIndex(index);
    try {
      if (await onEditFollowUp(index, editingQueueText.trim())) cancelQueueEdit();
    } finally {
      setQueueActionIndex(null);
    }
  };

  const sendQueueItemNow = async (index: number) => {
    if (!onSendFollowUpNow || editingQueueIndex !== null) return;
    setQueueActionIndex(index);
    try {
      if (await onSendFollowUpNow(index)) cancelQueueEdit();
    } finally {
      setQueueActionIndex(null);
    }
  };

  const replaceAtMarker = (insert: string) => {
    setText((current) => {
      const caret = Math.min(atCaretRef.current, current.length);
      const before = current.slice(0, caret);
      const atIndex = before.lastIndexOf("@");
      if (atIndex === -1) return current;
      const prefix = before.slice(0, atIndex);
      const suffix = current.slice(caret);
      return `${prefix}${insert} ${suffix}`;
    });
    setAtPickerOpen(false);
    setAtQuery("");
    textareaRef.current?.focus();
  };

  const findCommandToken = (value: string, caret: number) => {
    const beforeCaret = value.slice(0, caret);
    const match = /(?:^|\s)\/([^\s]*)$/.exec(beforeCaret);
    if (!match) return null;
    const tokenStart = match.index + (match[0].startsWith("/") ? 0 : 1);
    return { start: tokenStart, end: caret, query: match[1] ?? "" };
  };

  useEffect(() => {
    if (commandPickerOpen || commands.length === 0 || !text) return;
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const commandToken = findCommandToken(text, caret);
    if (!commandToken) return;
    commandTokenRef.current = commandToken;
    setCommandQuery(commandToken.query);
    setCommandHighlighted(0);
    setCommandPickerOpen(true);
    setAtPickerOpen(false);
  }, [commandPickerOpen, commands.length, text]);

  const selectCommand = (command: PaletteCommand) => {
    const token = commandTokenRef.current;
    if (!token) return;
    const insertion = `${command.name} `;
    const next = `${text.slice(0, token.start)}${insertion}${text.slice(token.end)}`;
    commandCaretRef.current = token.start + insertion.length;
    setText(next);
    commandTokenRef.current = null;
    setCommandPickerOpen(false);
    setCommandQuery("");
    textareaRef.current?.focus();
  };

  useEffect(() => {
    const caret = commandCaretRef.current;
    if (caret === null) return;
    textareaRef.current?.setSelectionRange(caret, caret);
    commandCaretRef.current = null;
  }, [text]);

  const pickSession = (session: SessionSummary) => {
    if (session.sessionFile) replaceAtMarker(`@session:${session.sessionFile}`);
  };

  const pickFile = async () => {
    const path = await onPickFile();
    if (!path) return;
    if (atPickerOpen && text.slice(0, atCaretRef.current).includes("@")) {
      replaceAtMarker(`@${path}`);
      return;
    }
    setText((current) => (current ? `${current} ${path}` : path));
    setAtPickerOpen(false);
    setAtQuery("");
    textareaRef.current?.focus();
  };

  const pickFileEntry = (file: ProjectFileEntry) => {
    replaceAtMarker(`@${file.path}`);
  };

  const filteredSessions = useMemo(() => {
    const q = atQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) => session.name.toLowerCase().includes(q));
  }, [sessions, atQuery]);

  useEffect(() => {
    if (!atPickerOpen || !listProjectFiles || projectFiles.length > 0) return;
    let active = true;
    setFilesLoading(true);
    void listProjectFiles().then((files) => {
      if (active) setProjectFiles(files);
    }).finally(() => {
      if (active) setFilesLoading(false);
    });
    return () => { active = false; };
  }, [atPickerOpen, listProjectFiles, projectFiles.length]);

  const filteredFiles = useMemo(() => {
    const q = atQuery.trim().toLowerCase();
    if (!q) return projectFiles.slice(0, 30);
    return projectFiles.filter((file) => {
      const name = file.path.split("/").pop()?.toLowerCase() ?? "";
      return name.includes(q) || file.path.toLowerCase().includes(q);
    }).slice(0, 30);
  }, [projectFiles, atQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isRunning) onAbort();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        textareaRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, onAbort]);

  useEffect(() => {
    if (!onThinkingLevel) return;
    if (!thinkingLevels.includes(thinkingLevel) && thinkingLevels[0]) {
      onThinkingLevel(thinkingLevels[0]);
    }
  }, [thinkingLevel, thinkingLevels, onThinkingLevel]);

  const contextTitle = [workspacePath, branchName].filter(Boolean).join(" · ");

  const resolvedProjectId = useMemo(() => {
    if (projectId && projects.some((item) => item.id === projectId)) return projectId;
    if (workspacePath) {
      const match = projects.find((item) => item.path === workspacePath || item.id === workspacePath);
      if (match) return match.id;
    }
    return projects[0]?.id ?? "";
  }, [projectId, projects, workspacePath]);
  const resolvedProjectName = projects.find((project) => project.id === resolvedProjectId)?.name ?? workspaceName ?? "Project";

  return (
    <div className="composer-area live-composer">
      {queue.followUp.length > 0 && (
        <div className="composer-queue" aria-label="Queue">
          <div className="composer-queue-header">
            <span>Queue</span>
            <span className="composer-queue-count">{queue.followUp.length}</span>
          </div>
          <div className="composer-queue-list">
            {queue.followUp.map((message, index) => {
              const isEditing = editingQueueIndex === index;
              const isActing = queueActionIndex === index;
              return (
                <div className={`composer-queue-item${isEditing ? " is-editing" : ""}`} key={index}>
                  {isEditing ? (
                    <textarea
                      className="composer-queue-editor"
                      aria-label={`Edit queued message ${index + 1}`}
                      value={editingQueueText}
                      onChange={(event) => setEditingQueueText(event.target.value)}
                      disabled={isActing}
                      autoFocus
                    />
                  ) : (
                    <div className="composer-queue-message">{message}</div>
                  )}
                  {onEditFollowUp && onSendFollowUpNow && (
                    <div className="composer-queue-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="composer-queue-action primary"
                            aria-label={`Save queued message ${index + 1}`}
                            disabled={isActing || !editingQueueText.trim()}
                            onClick={() => void saveQueueEdit()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="composer-queue-action"
                            aria-label={`Cancel editing queued message ${index + 1}`}
                            disabled={isActing}
                            onClick={cancelQueueEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="composer-queue-action"
                            aria-label={`Edit queued message ${index + 1}`}
                            disabled={queueActionIndex !== null || editingQueueIndex !== null}
                            onClick={() => beginQueueEdit(index)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="composer-queue-action primary"
                            aria-label={`Send queued message ${index + 1} now`}
                            disabled={queueActionIndex !== null || editingQueueIndex !== null}
                            onClick={() => void sendQueueItemNow(index)}
                          >
                            Send now
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="composer-card">
        <textarea
          className="composer-input"
          ref={textareaRef}
          aria-label="Message"
          value={text}
          placeholder={isRunning ? "Queue a follow-up..." : placeholder ?? "Ask Pi anything about this workspace..."}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (historyIndex >= 0) {
              setHistoryIndex(-1);
              historyDraftRef.current = "";
            }
            const caret = event.target.selectionStart ?? next.length;
            const beforeCaret = next.slice(0, caret);

            const commandToken = findCommandToken(next, caret);
            if (commandToken && commands.length > 0) {
              commandTokenRef.current = commandToken;
              setCommandQuery(commandToken.query);
              setCommandHighlighted(0);
              setCommandPickerOpen(true);
              setAtPickerOpen(false);
              return;
            }
            commandTokenRef.current = null;
            setCommandPickerOpen(false);

            const atIndex = beforeCaret.lastIndexOf("@");
            const prevChar = atIndex > 0 ? beforeCaret[atIndex - 1] : "";
            if (atIndex !== -1 && !/\w/.test(prevChar)) {
              atCaretRef.current = caret;
              setAtQuery(beforeCaret.slice(atIndex + 1));
              setAtPickerOpen(true);
            } else if (atIndex === -1) {
              setAtPickerOpen(false);
            }
          }}
          onKeyDown={(event) => {
            // Let IMEs consume Enter while choosing/committing a candidate.
            // WebKit can end composition before it dispatches that Enter, but
            // reports the legacy 229 key code for the IME-owned event.
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (commandPickerOpen) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCommandHighlighted((current) => Math.min(current + 1, Math.max(filteredCommands.length - 1, 0)));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCommandHighlighted((current) => Math.max(current - 1, 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setCommandPickerOpen(false);
                commandTokenRef.current = null;
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                const command = filteredCommands[commandHighlighted];
                if (command) {
                  event.preventDefault();
                  selectCommand(command);
                  return;
                }
              }
            }
            if (atPickerOpen && (event.key === "ArrowUp" || event.key === "ArrowDown")) return;
            if (
              (event.key === "ArrowUp" || event.key === "ArrowDown") &&
              !event.shiftKey &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey &&
              navigateHistory(event.key === "ArrowUp" ? "up" : "down")
            ) {
              event.preventDefault();
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && !atPickerOpen) {
              event.preventDefault();
              void submit();
            }
            if (event.key === "Escape" && atPickerOpen) {
              event.preventDefault();
              setAtPickerOpen(false);
            }
          }}
        />
        {commandPickerOpen && (
          <CommandPicker
            commands={commands}
            query={commandQuery}
            highlighted={commandHighlighted}
            onHighlight={setCommandHighlighted}
            onSelect={selectCommand}
          />
        )}
        {atPickerOpen && (
          <div className="at-picker" role="listbox" aria-label="Reference picker">
            <div className="at-picker-group">
              <div className="at-picker-label">Files</div>
              {filesLoading ? (
                <div className="at-picker-empty">Loading files…</div>
              ) : filteredFiles.length === 0 ? (
                <button type="button" className="at-picker-item" onClick={() => void pickFile()}>
                  <span className="at-picker-icon" aria-hidden>
                    <AppIcon name="folder" size="sm" />
                  </span>
                  <span className="at-picker-name">Browse file…</span>
                </button>
              ) : (
                filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className="at-picker-item"
                    onClick={() => pickFileEntry(file)}
                  >
                    <span className="at-picker-icon" aria-hidden>
                      <AppIcon name={file.isDir ? "folder" : "file"} size="sm" />
                    </span>
                    <span className="at-picker-name">{file.path}</span>
                  </button>
                ))
              )}
            </div>
            <div className="at-picker-group">
              <div className="at-picker-label">Sessions</div>
              {filteredSessions.length === 0 ? (
                <div className="at-picker-empty">No matching sessions</div>
              ) : (
                filteredSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    className="at-picker-item"
                    onClick={() => pickSession(session)}
                  >
                    <span className="at-picker-icon" aria-hidden>
                      <AppIcon name="messageSquare" size="sm" />
                    </span>
                    <span className="at-picker-name">{session.name}</span>
                    <span className="at-picker-meta">{new Date(session.updatedAt).toLocaleDateString()}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className="composer-toolbar">
          <div className="composer-primary-tools composer-tools">
            <ControlBox
              as="button"
              className="ctrl-box"
              ariaLabel="Attach file"
              buttonProps={{ onClick: () => void pickFile() }}
            >
              <AppIcon name="plus" size="sm" />
            </ControlBox>
          </div>

          <div className="composer-context-tools composer-meta">
            {onModeChange && (
              <div className="composer-mode-switch" role="group" aria-label="Agent mode">
                <button
                  type="button"
                  className={`composer-mode-option ${mode === "plan" ? "active" : ""}`}
                  aria-pressed={mode === "plan"}
                  disabled={isRunning}
                  title="Plan mode — project changes locked"
                  onClick={() => onModeChange("plan")}
                >
                  Plan
                </button>
                <button
                  type="button"
                  className={`composer-mode-option ${mode === "execute" ? "active" : ""}`}
                  aria-pressed={mode === "execute"}
                  disabled={isRunning}
                  title="Execute mode — tools can modify the project"
                  onClick={() => onModeChange("execute")}
                >
                  Execute
                </button>
              </div>
            )}
            {((onProjectChange || onOpenProject) || workspaceName || branchName) && (
              (onProjectChange || onOpenProject) ? (
                <ComposerMenu
                  className="composer-context-control"
                  title={contextTitle || workspacePath || resolvedProjectName}
                  ariaLabel="Project"
                  value={resolvedProjectId}
                  valueLabel={resolvedProjectName}
                  options={projects.map((project) => ({ value: project.id, label: project.name }))}
                  onChange={(next) => onProjectChange?.(next)}
                  actions={onOpenProject ? [{ id: "open-project", label: "Open project…", onSelect: onOpenProject }] : undefined}
                  suffix={branchName ? (
                    <>
                      <span className="composer-context-sep" aria-hidden>·</span>
                      <span className="composer-context-branch">{branchName}</span>
                    </>
                  ) : undefined}
                />
              ) : (
                <div className="composer-context-control" aria-label="Workspace context" title={contextTitle || undefined}>
                  {workspaceName && <span className="composer-context-workspace">{workspaceName}</span>}
                  {branchName && (
                    <>
                      <span className="composer-context-sep" aria-hidden>·</span>
                      <span className="composer-context-branch">{branchName}</span>
                    </>
                  )}
                </div>
              )
            )}
            {onModelSelect && (
              <ModelSelector
                variant="pill"
                className="composer-model"
                models={availableModels}
                current={resolvedModel}
                onSelect={onModelSelect}
              />
            )}
            {onThinkingLevel && (
              <ComposerMenu
                className="composer-thinking"
                ariaLabel="Thinking level"
                title="Thinking level"
                value={thinkingLevels.includes(thinkingLevel) ? thinkingLevel : thinkingLevels[0]}
                valueLabel={thinkingLevels.includes(thinkingLevel) ? thinkingLevel : thinkingLevels[0]}
                options={thinkingLevels.map((level) => ({ value: level, label: level }))}
                onChange={(level) => onThinkingLevel(level as ThinkingLevel)}
              />
            )}
          </div>

          <div className="composer-action-tools">
            {isRunning && (
              <button className="send-button stop" aria-label="Stop agent" onClick={onAbort}>
                ■
              </button>
            )}
            <button className="send-button" aria-label={isRunning ? "Queue follow-up" : "Send message"} onClick={() => void submit()}>
              ↑
            </button>
          </div>
        </div>
      </div>
      <div className="composer-hints">
        {queue.followUp.length === 0 && (
          <>
            <span>Enter to send</span>
            <span>Shift+Enter for newline</span>
          </>
        )}
        <span>Type / for commands</span>
      </div>
    </div>
  );
}
