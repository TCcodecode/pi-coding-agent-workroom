import { Fragment, memo, useMemo, useState, type KeyboardEvent } from "react";
import type { FileChangeSummary, SessionTodoItem, TimelineItem } from "../../shared/protocol";
import { Markdown } from "./Markdown";
import { AppIcon, type AppIconName } from "./icons";

type UserTimelineItem = TimelineItem & { kind: "user" };

export interface TimelineProps {
  items: TimelineItem[];
  /** Current session checklist; used to label task-grouped trace rows. */
  todos?: SessionTodoItem[];
  onReviewChanges?: (path?: string) => void;
  reviewOpen?: boolean;
  selectedReviewPath?: string;
  onCloseReview?: () => void;
  onUndoChanges?: (paths: string[]) => void | Promise<void>;
  /** User message ids that represent interrupted prompts and can expose inline actions. */
  interruptedUserMessageIds?: readonly string[];
  onCopyInterruptedMessage?: (item: UserTimelineItem) => void | Promise<void>;
  onEditInterruptedMessage?: (item: UserTimelineItem) => void;
  editingInterruptedMessage?: { messageId: string; text: string } | null;
  interruptedEditSaving?: boolean;
  onInterruptedMessageTextChange?: (text: string) => void;
  onSaveInterruptedMessageEdit?: () => void | Promise<void>;
  onCancelInterruptedMessageEdit?: () => void;
}

export const Timeline = memo(function Timeline({
  items,
  todos = [],
  onReviewChanges,
  reviewOpen = false,
  selectedReviewPath,
  onCloseReview,
  onUndoChanges,
  interruptedUserMessageIds = [],
  onCopyInterruptedMessage,
  onEditInterruptedMessage,
  editingInterruptedMessage = null,
  interruptedEditSaving = false,
  onInterruptedMessageTextChange,
  onSaveInterruptedMessageEdit,
  onCancelInterruptedMessageEdit,
}: TimelineProps) {
  const interruptedUserMessageIdSet = useMemo(
    () => new Set(interruptedUserMessageIds),
    [interruptedUserMessageIds],
  );
  if (items.length === 0) {
    return <div className="timeline-empty"><div className="empty-glyph"><AppIcon name="messageSquare" size="lg" /></div><p>Pi is ready when you are.</p></div>;
  }

  const turns = groupTurns(items);
  return (
    <div className="timeline">
      {turns.map((turn) => (
        <Turn
          key={turn[0]?.id ?? "turn"}
          items={turn}
          todos={todos}
          onReviewChanges={onReviewChanges}
          reviewOpen={reviewOpen}
          selectedReviewPath={selectedReviewPath}
          onCloseReview={onCloseReview}
          onUndoChanges={onUndoChanges}
          interruptedUserMessageIds={interruptedUserMessageIdSet}
          onCopyInterruptedMessage={onCopyInterruptedMessage}
          onEditInterruptedMessage={onEditInterruptedMessage}
          editingInterruptedMessage={editingInterruptedMessage}
          interruptedEditSaving={interruptedEditSaving}
          onInterruptedMessageTextChange={onInterruptedMessageTextChange}
          onSaveInterruptedMessageEdit={onSaveInterruptedMessageEdit}
          onCancelInterruptedMessageEdit={onCancelInterruptedMessageEdit}
        />
      ))}
    </div>
  );
}, (prev, next) => {
  // The timeline only needs to re-render when its items or the review
  // highlight change. Decoupling it from the app-wide store subscription means
  // status/queue/diagnostics events no longer force this subtree to render.
  return (
    prev.items === next.items &&
    prev.todos === next.todos &&
    prev.reviewOpen === next.reviewOpen &&
    prev.selectedReviewPath === next.selectedReviewPath &&
    prev.interruptedUserMessageIds === next.interruptedUserMessageIds &&
    prev.onCopyInterruptedMessage === next.onCopyInterruptedMessage &&
    prev.onEditInterruptedMessage === next.onEditInterruptedMessage &&
    prev.editingInterruptedMessage === next.editingInterruptedMessage &&
    prev.interruptedEditSaving === next.interruptedEditSaving &&
    prev.onInterruptedMessageTextChange === next.onInterruptedMessageTextChange &&
    prev.onSaveInterruptedMessageEdit === next.onSaveInterruptedMessageEdit &&
    prev.onCancelInterruptedMessageEdit === next.onCancelInterruptedMessageEdit
  );
});

/** Split the flat item stream into turns at user-message boundaries. */
function groupTurns(items: TimelineItem[]): TimelineItem[][] {
  const turns: TimelineItem[][] = [];
  let current: TimelineItem[] = [];
  for (const item of items) {
    if (item.kind === "user" && current.length > 0) {
      turns.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

type ToolItem = Extract<TimelineItem, { kind: "tool" }>;

/** A run of same-category completed tools collapsed into one expandable row. */
export interface ToolGroup {
  kind: "toolGroup";
  id: string;
  category: ToolCategory;
  items: ToolItem[];
  /** Completed thinking blocks absorbed from between the tools; shown expanded. */
  thinking: TimelineItem[];
}

type TimelineEntry = TimelineItem | ToolGroup;

const Turn = memo(function Turn({
  items,
  todos,
  onReviewChanges,
  reviewOpen,
  selectedReviewPath,
  onCloseReview,
  onUndoChanges,
  interruptedUserMessageIds,
  onCopyInterruptedMessage,
  onEditInterruptedMessage,
  editingInterruptedMessage,
  interruptedEditSaving,
  onInterruptedMessageTextChange,
  onSaveInterruptedMessageEdit,
  onCancelInterruptedMessageEdit,
}: {
  items: TimelineItem[];
  todos: SessionTodoItem[];
  onReviewChanges?: (path?: string) => void;
  reviewOpen: boolean;
  selectedReviewPath?: string;
  onCloseReview?: () => void;
  onUndoChanges?: (paths: string[]) => void | Promise<void>;
  interruptedUserMessageIds: ReadonlySet<string>;
  onCopyInterruptedMessage?: (item: UserTimelineItem) => void | Promise<void>;
  onEditInterruptedMessage?: (item: UserTimelineItem) => void;
  editingInterruptedMessage?: { messageId: string; text: string } | null;
  interruptedEditSaving?: boolean;
  onInterruptedMessageTextChange?: (text: string) => void;
  onSaveInterruptedMessageEdit?: () => void | Promise<void>;
  onCancelInterruptedMessageEdit?: () => void;
}) {
  const trace = mergeTimelineToolCalls(items);
  const changes = summarizeFileChanges(trace);
  const entries = groupTimelineTools(trace);
  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
  return (
    <div className="turn">
      {groupEntriesByTask(entries).map((chunk) => {
        const body = chunk.entries.map((entry) => entry.kind === "toolGroup"
          ? <ToolGroupView key={entry.id} group={entry} />
          : (
              <TimelineItemView
                key={entry.id}
                item={entry}
                interruptedUserMessageIds={interruptedUserMessageIds}
                onCopyInterruptedMessage={onCopyInterruptedMessage}
                onEditInterruptedMessage={onEditInterruptedMessage}
                editingInterruptedMessage={editingInterruptedMessage}
                interruptedEditSaving={interruptedEditSaving}
                onInterruptedMessageTextChange={onInterruptedMessageTextChange}
                onSaveInterruptedMessageEdit={onSaveInterruptedMessageEdit}
                onCancelInterruptedMessageEdit={onCancelInterruptedMessageEdit}
              />
            ));
        const todo = chunk.taskId ? todosById.get(chunk.taskId) : undefined;
        if (!todo) {
          return <Fragment key={chunk.entries[0]?.id ?? "loose"}>{body}</Fragment>;
        }
        return (
          <div className="timeline-task" key={chunk.taskId}>
            <TaskHeader todo={todo} />
            <div className="timeline-task-body">{body}</div>
          </div>
        );
      })}
      {changes && (
        <ChangeSummary
          key="changes"
          changes={changes}
          onReviewChanges={onReviewChanges}
          reviewOpen={reviewOpen}
          selectedReviewPath={selectedReviewPath}
          onCloseReview={onCloseReview}
          onUndoChanges={onUndoChanges}
        />
      )}
    </div>
  );
}, (prev, next) => {
  // A turn only re-renders when one of its items changed identity. The store
  // preserves references for untouched items, so a streaming delta re-renders
  // exactly one turn instead of the whole timeline.
  if (prev.items.length !== next.items.length) return false;
  for (let i = 0; i < prev.items.length; i += 1) {
    if (prev.items[i] !== next.items[i]) return false;
  }
  return (
    prev.onReviewChanges === next.onReviewChanges &&
    prev.reviewOpen === next.reviewOpen &&
    prev.selectedReviewPath === next.selectedReviewPath &&
    prev.onCloseReview === next.onCloseReview &&
    prev.onUndoChanges === next.onUndoChanges &&
    prev.todos === next.todos &&
    prev.interruptedUserMessageIds === next.interruptedUserMessageIds &&
    prev.onCopyInterruptedMessage === next.onCopyInterruptedMessage &&
    prev.onEditInterruptedMessage === next.onEditInterruptedMessage &&
    prev.editingInterruptedMessage === next.editingInterruptedMessage &&
    prev.interruptedEditSaving === next.interruptedEditSaving &&
    prev.onInterruptedMessageTextChange === next.onInterruptedMessageTextChange &&
    prev.onSaveInterruptedMessageEdit === next.onSaveInterruptedMessageEdit &&
    prev.onCancelInterruptedMessageEdit === next.onCancelInterruptedMessageEdit
  );
});

/**
 * Merge a tool call entry and its toolResult entry (they share toolCallId)
 * into one row so hydrated sessions don't double-count every tool.
 * Status priority: error > completed > running/streaming.
 */
function mergeToolCalls(tools: ToolItem[]): ToolItem[] {
  const merged = new Map<string, ToolItem>();
  const order: string[] = [];
  for (const tool of tools) {
    const key = tool.toolCallId || tool.id;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...tool });
      order.push(key);
    } else {
      if (!existing.input && tool.input) existing.input = tool.input;
      if (!existing.output && tool.output) existing.output = tool.output;
      if (!existing.change && tool.change) existing.change = tool.change;
      if (!existing.startedAt && tool.startedAt) existing.startedAt = tool.startedAt;
      if (tool.completedAt) existing.completedAt = tool.completedAt;
      if (tool.status === "error") existing.status = "error";
      else if (existing.status !== "error" && tool.status === "completed") existing.status = "completed";
    }
  }
  return order.map((key) => merged.get(key)!);
}

/**
 * Preserve the incoming event order while merging each persisted tool-result
 * into its originating call. A trace action must never move ahead of an
 * assistant message merely because it happens to be a tool.
 */
function mergeTimelineToolCalls(items: TimelineItem[]): TimelineItem[] {
  const result: TimelineItem[] = [];
  const toolIndex = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "tool") {
      result.push(item);
      continue;
    }
    const key = item.toolCallId || item.id;
    const index = toolIndex.get(key);
    if (index === undefined) {
      toolIndex.set(key, result.length);
      result.push({ ...item });
      continue;
    }
    const existing = result[index];
    if (!existing || existing.kind !== "tool") continue;
    result[index] = mergeToolCalls([existing, item])[0];
  }
  return result;
}

interface FileChangeTotals {
  files: FileChangeSummary[];
  additions: number;
  deletions: number;
}

function summarizeFileChanges(items: TimelineItem[]): FileChangeTotals | undefined {
  const files = collectFileChanges(items);
  if (files.length === 0) return undefined;
  return {
    files,
    additions: files.reduce((total, change) => total + change.additions, 0),
    deletions: files.reduce((total, change) => total + change.deletions, 0),
  };
}

/** Collect all file mutations in a session, deduping persisted tool call/result pairs. */
export function collectFileChanges(items: TimelineItem[]): FileChangeSummary[] {
  const changes = new Map<string, FileChangeSummary>();
  for (const item of mergeToolCalls(items.filter((candidate): candidate is ToolItem => candidate.kind === "tool"))) {
    if (!item.change) continue;
    const current = changes.get(item.change.path);
    changes.set(item.change.path, current
      ? {
          path: current.path,
          additions: current.additions + item.change.additions,
          deletions: current.deletions + item.change.deletions,
          diff: [current.diff, item.change.diff].filter(Boolean).join("\n"),
        }
      : { ...item.change });
  }
  return [...changes.values()];
}

function ChangeSummary({
  changes,
  onReviewChanges,
  reviewOpen,
  selectedReviewPath,
  onCloseReview,
  onUndoChanges,
}: {
  changes: FileChangeTotals;
  onReviewChanges?: (path?: string) => void;
  reviewOpen: boolean;
  selectedReviewPath?: string;
  onCloseReview?: () => void;
  onUndoChanges?: (paths: string[]) => void | Promise<void>;
}) {
  const [showMore, setShowMore] = useState(false);
  const fileLabel = `${changes.files.length} ${changes.files.length === 1 ? "file" : "files"}`;
  const visibleFiles = showMore ? changes.files : changes.files.slice(0, 3);
  const hasMore = changes.files.length > 3;
  const openOrClose = (path?: string) => {
    if (reviewOpen && (!path || selectedReviewPath === path)) onCloseReview?.();
    else onReviewChanges?.(path);
  };

  return (
    <section className="change-summary" aria-label="File changes">
      <div className="change-summary-header">
        <div className="change-summary-title">
          <span className="change-summary-icon"><AppIcon name="fileCode2" size="lg" /></span>
          <div>
            <strong>Edited {fileLabel}</strong>
            <div className="change-summary-stats">
              <span className="change-additions">+{changes.additions}</span>
              <span className="change-deletions">-{changes.deletions}</span>
            </div>
          </div>
        </div>
        <div className="change-summary-actions">
          {changes.files.length > 1 && onUndoChanges && (
            <button
              type="button"
              className="change-summary-undo"
              aria-label="Undo file changes"
              title="Undo file changes"
              onClick={() => void onUndoChanges(changes.files.map((change) => change.path))}
            >
              <span>Undo</span>
              <AppIcon name="undo" size="xs" />
            </button>
          )}
          <button
            type="button"
            className="change-summary-review"
            aria-label="Review file changes"
            title="Review file changes"
            onClick={() => openOrClose(changes.files[0]?.path)}
          >
            <AppIcon name="panelRight" size="xs" />
            Review
          </button>
        </div>
      </div>
      <div className={`change-summary-files ${changes.files.length === 1 ? "is-single-file" : ""}`}>
        {visibleFiles.map((change) => (
          <button
            type="button"
            className="change-summary-file"
            key={change.path}
            aria-label={`Review ${change.path}`}
            onClick={() => openOrClose(change.path)}
          >
            <span className="change-summary-path">{change.path}</span>
            <span className="change-summary-file-stats">
              <span className="change-additions">+{change.additions}</span>
              <span className="change-deletions">-{change.deletions}</span>
            </span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button type="button" className="change-summary-more" onClick={() => setShowMore((open) => !open)}>
          {showMore ? "Show fewer files" : "Show more files"}
        </button>
      )}
    </section>
  );
}

const TOOL_PREVIEW_KEYS = ["command", "pattern", "query", "path", "file", "filePath", "url", "glob", "directory", "name"];

type ToolCategory = "shell" | "read" | "search" | "change" | "web" | "plan" | "mcp" | "other";

interface ToolPresentation {
  label: string;
  category: ToolCategory;
  icon: AppIconName;
  preview?: string;
}

/**
 * Categories whose consecutive completed tools collapse into one row. Edits,
 * MCP calls, and plan updates stay individual because each carries a distinct
 * file diff, server·tool target, or checklist change that grouping would hide.
 */
const AGGREGATABLE_CATEGORIES: ReadonlySet<ToolCategory> = new Set(["shell", "read", "search", "web", "other"]);

const CATEGORY_GROUP_LABEL: Record<ToolCategory, (count: number) => string> = {
  shell: (count) => `Ran ${count} ${count === 1 ? "command" : "commands"}`,
  read: (count) => `Read ${count} ${count === 1 ? "file" : "files"}`,
  search: (count) => `Searched ${count} ${count === 1 ? "time" : "times"}`,
  change: (count) => `Changed ${count} ${count === 1 ? "file" : "files"}`,
  web: (count) => `Browsed ${count} ${count === 1 ? "time" : "times"}`,
  mcp: (count) => `MCP · ${count} ${count === 1 ? "call" : "calls"}`,
  plan: (count) => `Updated plan ${count} ${count === 1 ? "time" : "times"}`,
  other: (count) => `Used ${count} ${count === 1 ? "tool" : "tools"}`,
};

/**
 * MCP-backed tools surface as the adapter's unified proxy tool (`mcp`) or as
 * prefixed direct tools (`mcp__<server>__<tool>`). Light annotation only —
 * no data-flow changes.
 */
function isMcpTool(name: string): boolean {
  return name === "mcp" || name.startsWith("mcp__") || name.startsWith("mcp_");
}

/** Extract a one-line human summary from a tool call's input. */
function toolPreview(input: string, preferredKeys = TOOL_PREVIEW_KEYS): string {
  const text = input.trim();
  if (!text) return "";
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const key of preferredKeys) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      const first = Object.values(obj).find((value): value is string => typeof value === "string" && Boolean(value.trim()));
      if (first) return first.trim();
      return JSON.stringify(obj).replace(/[{}"[\]]/g, "").slice(0, 80);
    } catch {
      /* not JSON — fall through to raw text */
    }
  }
  return text.split("\n")[0];
}

function parsedToolInput(input: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(input) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function stringInput(input: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!input) return undefined;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function mcpTarget(toolName: string, input: string): string | undefined {
  if (toolName.startsWith("mcp__")) {
    const [, server, ...toolParts] = toolName.split("__");
    return [server, toolParts.join("__")].filter(Boolean).join(" · ") || undefined;
  }
  const parsed = parsedToolInput(input);
  const tool = stringInput(parsed, ["tool", "name", "method"]);
  const server = stringInput(parsed, ["server", "serverName"]);
  return [server, tool].filter(Boolean).join(" · ") || undefined;
}

function describeTool(item: ToolItem): ToolPresentation {
  const name = item.toolName.toLowerCase();
  if (isMcpTool(name)) {
    return { label: "MCP", category: "mcp", icon: "wrench", preview: mcpTarget(item.toolName, item.input) };
  }
  if (["bash", "shell", "exec", "execute", "terminal", "command"].includes(name)) {
    return { label: "Ran", category: "shell", icon: "play", preview: toolPreview(item.input, ["command", "script", "cmd"]) };
  }
  if (["read", "cat", "open_file", "view_file", "list", "ls", "list_files"].includes(name)) {
    return { label: "Read", category: "read", icon: "fileText", preview: toolPreview(item.input, ["path", "file", "filePath", "directory", "glob"]) };
  }
  if (["grep", "rg", "search", "find", "glob", "code_search", "mcp_search"].includes(name)) {
    return { label: "Searched", category: "search", icon: "search", preview: toolPreview(item.input, ["pattern", "query", "glob", "path", "file"]) };
  }
  if (["edit", "patch", "apply_patch", "replace"].includes(name)) {
    return { label: "Edited", category: "change", icon: "fileCode2", preview: toolPreview(item.input, ["path", "file", "filePath"]) };
  }
  if (["write", "create", "create_file"].includes(name)) {
    return { label: "Wrote", category: "change", icon: "fileCode2", preview: toolPreview(item.input, ["path", "file", "filePath"]) };
  }
  if (["delete", "remove", "rm", "delete_file"].includes(name)) {
    return { label: "Deleted", category: "change", icon: "trash", preview: toolPreview(item.input, ["path", "file", "filePath"]) };
  }
  if (["web", "browser", "fetch", "http", "http_request"].includes(name)) {
    return { label: "Browsed", category: "web", icon: "globe", preview: toolPreview(item.input, ["url", "query", "path"]) };
  }
  if (["todowrite", "todo", "update_todos"].includes(name)) {
    return { label: "Updated plan", category: "plan", icon: "check", preview: toolPreview(item.input, ["content", "summary", "name"]) };
  }
  return { label: "Used tool", category: "other", icon: "wrench", preview: toolPreview(item.input) };
}

/**
 * Collapse consecutive completed tool calls of a noisy category into one
 * expandable row. Hard breaks (user/assistant text, notifications, errors,
 * in-flight tools) and non-aggregatable tools flush any pending group.
 * Completed thinking blocks between the tools are absorbed into the group
 * instead of eating their own row; standalone thinking stays visible.
 */
export function groupTimelineTools(trace: TimelineItem[]): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  let group: ToolItem[] = [];
  let groupCategory: ToolCategory | undefined;
  let groupTaskId: string | undefined;
  let groupThinking: TimelineItem[] = [];
  let pendingThinking: TimelineItem[] = [];

  const flush = () => {
    if (group.length === 1) {
      result.push(...groupThinking);
      result.push(group[0]!);
    } else if (group.length > 1) {
      result.push({
        kind: "toolGroup",
        id: `group:${group[0]!.id}`,
        category: groupCategory!,
        items: group,
        thinking: groupThinking,
      });
    }
    group = [];
    groupCategory = undefined;
    groupTaskId = undefined;
    groupThinking = [];
  };

  const flushPendingThinking = () => {
    if (pendingThinking.length > 0) {
      result.push(...pendingThinking);
      pendingThinking = [];
    }
  };

  for (const item of trace) {
    if (item.kind === "thinking" && item.status !== "streaming") {
      pendingThinking.push(item);
      continue;
    }
    if (item.kind === "tool" && item.status === "completed") {
      const category = describeTool(item).category;
      if (AGGREGATABLE_CATEGORIES.has(category)) {
        // Never merge tools that belong to different todos: the group header
        // would mislabel half the run under the wrong task.
        if (groupCategory === category && groupTaskId === item.taskId) {
          group.push(item);
          groupThinking.push(...pendingThinking);
          pendingThinking = [];
          continue;
        }
        flush();
        group = [item];
        groupCategory = category;
        groupTaskId = item.taskId;
        groupThinking = [...pendingThinking];
        pendingThinking = [];
        continue;
      }
    }
    flush();
    flushPendingThinking();
    result.push(item);
  }
  flush();
  flushPendingThinking();
  return result;
}

/** The task a trace row belongs to (groups use their first tool's task). */
function entryTaskId(entry: TimelineEntry): string | undefined {
  return entry.kind === "toolGroup" ? entry.items[0]?.taskId : entry.taskId;
}

interface TaskChunk {
  taskId?: string;
  entries: TimelineEntry[];
}

/** Split entries into runs sharing one in-progress todo; loose rows stand alone. */
function groupEntriesByTask(entries: TimelineEntry[]): TaskChunk[] {
  const chunks: TaskChunk[] = [];
  let current: TaskChunk | undefined;
  for (const entry of entries) {
    const taskId = entryTaskId(entry);
    if (!current || current.taskId !== taskId) {
      current = { taskId, entries: [] };
      chunks.push(current);
    }
    current.entries.push(entry);
  }
  return chunks;
}

function TaskHeader({ todo }: { todo: SessionTodoItem }) {
  const icon: AppIconName =
    todo.status === "completed" ? "circleCheck"
    : todo.status === "in_progress" ? "circleDot"
    : todo.status === "cancelled" ? "x"
    : "circle";
  return (
    <div className="timeline-task-header" title={todo.content}>
      <span className={`timeline-task-mark ${todo.status}`} aria-hidden>
        <AppIcon name={icon} size="xs" />
      </span>
      <span className="timeline-task-title">{todo.content}</span>
      <span className={`timeline-task-state ${todo.status}`}>{todo.status}</span>
    </div>
  );
}

function oneLine(text: string, limit = 120): string | undefined {
  const line = text.split("\n").map((value) => value.trim()).find(Boolean);
  if (!line) return undefined;
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

/**
 * Keep raw payloads opt-in, but make command outcome and file-change impact
 * visible directly on the trace row. File reads/searches deliberately avoid
 * default output, since their payload is usually the noisy part.
 */
function toolResultSummary(item: ToolItem, presentation: ToolPresentation): string | undefined {
  if (item.status === "error") return oneLine(item.output ?? "") || "failed";
  if (item.change) {
    const stats = [item.change.additions ? `+${item.change.additions}` : "", item.change.deletions ? `−${item.change.deletions}` : ""].filter(Boolean).join(" ");
    return stats || "changed";
  }
  return presentation.category === "shell" ? oneLine(item.output ?? "") : undefined;
}

function durationBetween(start: string | undefined, end: string | undefined): string | undefined {
  if (!start || !end) return undefined;
  const elapsed = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return undefined;
  if (elapsed < 1000) return `${elapsed}ms`;
  return `${(elapsed / 1000).toFixed(elapsed >= 10_000 ? 0 : 1).replace(/\.0$/, "")}s`;
}

function timelineDuration(item: TimelineItem): string | undefined {
  return durationBetween(item.startedAt, item.completedAt);
}

function groupDuration(items: ToolItem[]): string | undefined {
  return durationBetween(items[0]?.startedAt, items[items.length - 1]?.completedAt);
}

function thinkingSummary(content: string): string | undefined {
  // Only the first line is needed; avoid splitting the entire (possibly large,
  // still-streaming) thinking block on every render.
  const newline = content.indexOf("\n");
  const firstLine = (newline === -1 ? content : content.slice(0, newline)).trim();
  if (!firstLine) return undefined;
  return firstLine.length > 96 ? `${firstLine.slice(0, 95)}…` : firstLine;
}

function ToolGroupView({ group }: { group: ToolGroup }) {
  const [expanded, setExpanded] = useState(false);
  const first = group.items[0]!;
  const presentation = describeTool(first);
  const label = CATEGORY_GROUP_LABEL[group.category](group.items.length);
  const duration = groupDuration(group.items);
  const toggle = () => setExpanded((value) => !value);
  return (
    <article className="timeline-item tool-item tool-group completed">
      <div
        className="timeline-item-heading toggleable"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        onClick={toggle}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }}
      >
        <span className="timeline-icon tool" aria-hidden><AppIcon name="circleCheck" size="xs" /></span>
        <span className={`timeline-icon tool-action tool-action-${group.category}`} aria-hidden><AppIcon name={presentation.icon} size="xs" /></span>
        <strong className="tool-name" title={label}>{label}</strong>
        <span className="tool-group-count" title={`${group.items.length} tool calls`}>{group.items.length}</span>
        {presentation.preview && <><span className="tool-sep">·</span><span className="tool-inline-preview">{presentation.preview}</span></>}
        {duration && <span className="timeline-duration">{duration}</span>}
        <AppIcon name="chevronRight" size="xs" className={`timeline-chevron ${expanded ? "open" : ""}`} />
      </div>
      {expanded && (
        <div className="tool-group-body">
          {group.thinking.map((thinking) => <TimelineItemView key={thinking.id} item={thinking} interruptedUserMessageIds={EMPTY_MESSAGE_ID_SET} />)}
          {group.items.map((tool) => <TimelineItemView key={tool.id} item={tool} interruptedUserMessageIds={EMPTY_MESSAGE_ID_SET} />)}
        </div>
      )}
    </article>
  );
}

const EMPTY_MESSAGE_ID_SET = new Set<string>();

const TimelineItemView = memo(function TimelineItemView({
  item,
  interruptedUserMessageIds = EMPTY_MESSAGE_ID_SET,
  onCopyInterruptedMessage,
  onEditInterruptedMessage,
  editingInterruptedMessage,
  interruptedEditSaving = false,
  onInterruptedMessageTextChange,
  onSaveInterruptedMessageEdit,
  onCancelInterruptedMessageEdit,
}: {
  item: TimelineItem;
  interruptedUserMessageIds?: ReadonlySet<string>;
  onCopyInterruptedMessage?: (item: UserTimelineItem) => void | Promise<void>;
  onEditInterruptedMessage?: (item: UserTimelineItem) => void;
  editingInterruptedMessage?: { messageId: string; text: string } | null;
  interruptedEditSaving?: boolean;
  onInterruptedMessageTextChange?: (text: string) => void;
  onSaveInterruptedMessageEdit?: () => void | Promise<void>;
  onCancelInterruptedMessageEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((value) => !value);
  if (item.kind === "divider") {
    const retry = item.label.startsWith("retry");
    const labelText =
      item.label === "compacting" ? "Compacting context…"
      : item.label === "compacted" ? "Context compacted"
      : item.label === "retrying" ? "Retrying…"
      : "Auto-retried";
    return (
      <div className={`timeline-divider ${item.status}`} role="status">
        <span className="timeline-divider-line" aria-hidden />
        <span className="timeline-divider-label">
          <AppIcon name={retry ? "circleDot" : "history"} size="xs" />
          {labelText}
          {item.detail && <span className="timeline-divider-detail" title={item.detail}>{item.detail}</span>}
        </span>
        <span className="timeline-divider-line" aria-hidden />
      </div>
    );
  }
  if (item.kind === "tool") {
    const presentation = describeTool(item);
    const preview = presentation.preview || toolPreview(item.input) || toolPreview(item.output ?? "");
    const resultSummary = toolResultSummary(item, presentation);
    const hasInput = item.input.trim() !== "";
    const hasOutput = Boolean(item.output && item.output.trim() !== "");
    const duration = timelineDuration(item);
    const status = item.status === "running" ? "running" : item.status === "error" ? "failed" : undefined;
    return (
      <article className={`timeline-item tool-item ${item.status}`}>
        <div
          className="timeline-item-heading toggleable"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${presentation.label} (${item.toolName})`}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        >
          <span className="timeline-icon tool" aria-hidden>
            <AppIcon name={item.status === "error" ? "circleAlert" : item.status === "completed" ? "circleCheck" : "circleDot"} size="xs" />
          </span>
          <span className={`timeline-icon tool-action tool-action-${presentation.category}`} aria-hidden><AppIcon name={presentation.icon} size="xs" /></span>
          <strong className="tool-name" title={item.toolName}>{presentation.label}</strong>
          {isMcpTool(item.toolName) && <span className="mcp-tag">via MCP</span>}
          <span className="tool-sep">·</span>
          <span className="tool-inline-preview">{preview || item.status}</span>
          {resultSummary && <span className={`tool-result-summary ${item.status === "error" ? "failed" : ""}`}>{resultSummary}</span>}
          {duration && <span className="timeline-duration">{duration}</span>}
          {status && <span className={`timeline-status ${item.status === "error" ? "failed" : ""}`}>{status}</span>}
          <AppIcon name="chevronRight" size="xs" className={`timeline-chevron ${expanded ? "open" : ""}`} />
        </div>
        {expanded && (hasInput || hasOutput) && (
          <div className="tool-body">
            {hasInput && <code>{item.input}</code>}
            {hasOutput && <pre>{item.output}</pre>}
          </div>
        )}
      </article>
    );
  }

  if (item.kind === "thinking") {
    const duration = timelineDuration(item);
    const summary = thinkingSummary(item.content);
    const label = duration ? `Thinking · ${duration}` : "Thinking";
    return (
      <article className={`timeline-item thinking-item ${item.status}`}>
        <div
          className="timeline-item-heading toggleable"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} thinking`}
          onClick={toggle}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }}
          title={summary}
        >
          <span className="timeline-icon thinking" aria-hidden><AppIcon name="brain" size="xs" /></span>
          <strong>{label}</strong>
          {item.status === "streaming" && <span className="timeline-status">running</span>}
          <AppIcon name="chevronRight" size="xs" className={`timeline-chevron ${expanded ? "open" : ""}`} />
        </div>
        {expanded && item.content.trim() && <div className="thinking-body">{item.content}</div>}
      </article>
    );
  }

  if (item.content.trim() === "") return null;

  if (item.kind === "user") {
    const userItem = item as UserTimelineItem;
    const isEditingInterruptedMessage = editingInterruptedMessage?.messageId === item.id;
    const showInterruptedActions =
      !isEditingInterruptedMessage &&
      interruptedUserMessageIds.has(item.id) &&
      (Boolean(onCopyInterruptedMessage) || Boolean(onEditInterruptedMessage));
    const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelInterruptedMessageEdit?.();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void onSaveInterruptedMessageEdit?.();
      }
    };
    return (
      <article className={`timeline-item message-item user${showInterruptedActions ? " is-interrupted-actionable" : ""}`}>
        <div className="timeline-item-heading timeline-message-heading">
          <div className="timeline-message-heading-main">
            <span className="timeline-icon user"><AppIcon name="user" size="sm" /></span>
            <strong>You</strong>
          </div>
        </div>
        {isEditingInterruptedMessage ? (
          <div className="timeline-inline-editor">
            <textarea
              className="timeline-inline-editor-input"
              aria-label="Edit interrupted message"
              value={editingInterruptedMessage.text}
              rows={Math.max(3, Math.min(10, editingInterruptedMessage.text.split("\n").length))}
              onChange={(event) => onInterruptedMessageTextChange?.(event.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
            />
            <div className="timeline-message-actions timeline-message-actions-inline" aria-label="Interrupted message edit actions">
              <button
                type="button"
                className="timeline-message-action timeline-message-action-icon"
                aria-label="Save interrupted message"
                title="Save interrupted message"
                disabled={interruptedEditSaving || editingInterruptedMessage.text.trim().length === 0}
                onClick={() => void onSaveInterruptedMessageEdit?.()}
              >
                <AppIcon name="save" size="xs" />
              </button>
              <button
                type="button"
                className="timeline-message-action timeline-message-action-icon"
                aria-label="Cancel interrupted message edit"
                title="Cancel interrupted message edit"
                disabled={interruptedEditSaving}
                onClick={() => onCancelInterruptedMessageEdit?.()}
              >
                <AppIcon name="x" size="xs" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="message-content"><Markdown content={item.content} /></div>
            {showInterruptedActions && (
              <div className="timeline-message-actions timeline-message-actions-below" aria-label="Interrupted message actions">
                {onCopyInterruptedMessage && (
                  <button
                    type="button"
                    className="timeline-message-action timeline-message-action-icon"
                    aria-label="Copy interrupted message"
                    title="Copy interrupted message"
                    onClick={() => void onCopyInterruptedMessage(userItem)}
                  >
                    <AppIcon name="copy" size="xs" />
                  </button>
                )}
                {onEditInterruptedMessage && (
                  <button
                    type="button"
                    className="timeline-message-action timeline-message-action-icon"
                    aria-label="Edit interrupted message"
                    title="Edit interrupted message"
                    onClick={() => onEditInterruptedMessage(userItem)}
                  >
                    <AppIcon name="pencil" size="xs" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    );
  }

  // assistant: markdown; notification / error: plain system text, no header — Codex style
  return (
    <article className={`timeline-item message-item ${item.kind}`}>
      {item.kind === "error" && <span className="message-error">error</span>}
      <div className="message-content">
        {item.kind === "assistant" ? <Markdown content={item.content} plain={item.status === "streaming"} /> : item.content}
      </div>
    </article>
  );
});
