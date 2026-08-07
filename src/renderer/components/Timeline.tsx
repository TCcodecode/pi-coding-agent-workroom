import { useState } from "react";
import type { FileChangeSummary, SessionStatus, TimelineItem } from "../../shared/protocol";
import { Markdown } from "./Markdown";
import { AppIcon } from "./icons";

export interface TimelineProps {
  items: TimelineItem[];
  sessionStatus?: SessionStatus;
  onReviewChanges?: (path?: string) => void;
}

export function Timeline({ items, sessionStatus, onReviewChanges }: TimelineProps) {
  if (items.length === 0) {
    return <div className="timeline-empty"><div className="empty-glyph"><AppIcon name="messageSquare" size="lg" /></div><p>Pi is ready when you are.</p></div>;
  }

  const turns = groupTurns(items);
  return (
    <div className="timeline">
      {turns.map((turn, index) => (
        <Turn
          key={turn[0]?.id ?? "turn"}
          items={turn}
          isCurrentTurn={index === turns.length - 1}
          sessionStatus={sessionStatus}
          onReviewChanges={onReviewChanges}
        />
      ))}
    </div>
  );
}

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

// The message variant uses a wide kind union; intersect to get specific shapes.
type ThinkingItem = TimelineItem & { kind: "thinking" };
type ToolItem = Extract<TimelineItem, { kind: "tool" }>;
type ActivityItem = ThinkingItem | ToolItem;
type ActivityUnit =
  | { kind: "thinking"; item: ThinkingItem }
  | { kind: "tools"; items: ToolItem[] };

function Turn({
  items,
  isCurrentTurn,
  sessionStatus,
  onReviewChanges,
}: {
  items: TimelineItem[];
  isCurrentTurn: boolean;
  sessionStatus?: SessionStatus;
  onReviewChanges?: (path?: string) => void;
}) {
  const prompts = items.filter((item) => item.kind === "user");
  const textItems = items.filter((item) => item.kind !== "user" && item.kind !== "thinking" && item.kind !== "tool");
  const activityItems = items.filter((item): item is ActivityItem => item.kind === "thinking" || item.kind === "tool");
  const activityActive = isActivityActive(activityItems);
  const changes = summarizeFileChanges(activityItems);
  const live = isCurrentTurn && (
    sessionStatus === undefined
      ? activityActive
      : sessionStatus === "running" || sessionStatus === "awaiting_approval"
  );
  return (
    <div className="turn">
      {prompts.map((item) => <TimelineItemView key={item.id} item={item} />)}
      {activityItems.length > 0 && <ActivityBlock key="activity" items={activityItems} live={live} />}
      {textItems.map((item) => <TimelineItemView key={item.id} item={item} />)}
      {changes && <ChangeSummary key="changes" changes={changes} onReviewChanges={onReviewChanges} />}
    </div>
  );
}

function isActivityActive(items: ActivityItem[]): boolean {
  return items.some((item) => item.kind === "thinking" ? item.status === "streaming" : item.status === "running");
}

/**
 * The agent's thinking + tool use for a turn, as one accordion:
 * - done: a single summary row
 * - live: the summary row + a live tail (fixed size), held open for the
 *   current turn rather than derived from individual event boundaries
 * - expanded: the summary row + the full ordered trace; thinking is shown
 *   inline as plain text, tools as terse lines (Codex style)
 */
function ActivityBlock({ items, live }: { items: ActivityItem[]; live: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const units = buildUnits(items);
  const allTools = units.flatMap((unit) => (unit.kind === "tools" ? unit.items : []));
  const { summary, failed, running } = summarizeTools(allTools);
  const label = expanded ? "Collapse agent activity" : "Expand agent activity";
  const toggle = () => setExpanded((value) => !value);
  const tail = units.slice(-3);
  const overflow = units.length - tail.length;
  const shown = expanded ? units : tail;

  return (
    <div className="activity-block">
      <div
        className="activity-heading"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={label}
        onClick={toggle}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }}
      >
        <strong>{summary || "Thinking"}</strong>
        <AppIcon name="chevronRight" size="xs" className={`activity-chevron ${expanded ? "open" : ""}`} />
        {running > 0 && <span className="activity-status">{running} running</span>}
        {failed > 0 && <span className="activity-status failed">{failed} failed</span>}
      </div>
      {(expanded || live) && (
        <div className="activity-trace">
          {!expanded && overflow > 0 && <div className="activity-more">… {overflow} more</div>}
          {shown.map((unit, index) => {
            if (unit.kind === "thinking") {
              return expanded
                ? <div key={unit.item.id} className="thinking-inline">{unit.item.content}</div>
                : <div key={unit.item.id} className="activity-line"><AppIcon name="circleDot" size="xs" className="activity-dot" />Thinking</div>;
            }
            const single = unit.items[0];
            if (expanded) {
              return single && unit.items.length === 1
                ? <TimelineItemView key={single.toolCallId || single.id} item={single} />
                : <ToolGroup key={single?.id ?? `tools-${index}`} tools={unit.items} />;
            }
            return (
              <div key={single?.id ?? `tools-${index}`} className="activity-line">
                <AppIcon name="chevronRight" size="xs" className="activity-dot" />
                <span className="activity-line-text">{summarizeTools(unit.items).summary}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Group the ordered activity into thinking units and consecutive tool units, deduped. */
function buildUnits(activity: ActivityItem[]): ActivityUnit[] {
  const units: ActivityUnit[] = [];
  for (const item of activity) {
    if (item.kind === "thinking") {
      units.push({ kind: "thinking", item });
    } else {
      const last = units[units.length - 1];
      if (last && last.kind === "tools") last.items.push(item);
      else units.push({ kind: "tools", items: [item] });
    }
  }
  return units.map((unit) => (unit.kind === "tools" ? { ...unit, items: mergeToolCalls(unit.items) } : unit));
}

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
      if (tool.status === "error") existing.status = "error";
      else if (existing.status !== "error" && tool.status === "completed") existing.status = "completed";
    }
  }
  return order.map((key) => merged.get(key)!);
}

interface FileChangeTotals {
  files: FileChangeSummary[];
  additions: number;
  deletions: number;
}

function summarizeFileChanges(items: ActivityItem[]): FileChangeTotals | undefined {
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

function ChangeSummary({ changes, onReviewChanges }: { changes: FileChangeTotals; onReviewChanges?: (path?: string) => void }) {
  const [showMore, setShowMore] = useState(false);
  const fileLabel = `${changes.files.length} ${changes.files.length === 1 ? "file" : "files"}`;
  const visibleFiles = showMore ? changes.files : changes.files.slice(0, 3);
  const hasMore = changes.files.length > 3;

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
        <button
          type="button"
          className="change-summary-review"
          aria-label="Review file changes"
          onClick={() => onReviewChanges?.(changes.files[0]?.path)}
        >
          <AppIcon name="panelRight" size="xs" />
          Review
        </button>
      </div>
      <div className="change-summary-files">
        {visibleFiles.map((change) => (
          <button
            type="button"
            className="change-summary-file"
            key={change.path}
            aria-label={`Review ${change.path}`}
            onClick={() => onReviewChanges?.(change.path)}
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

const TOOL_VERBS: Array<[RegExp, string]> = [
  [/^(read|read_file|cat|view|list|list_dir|ls|dir|glob|grep|search|find|skills?|resources?|docs?)$/, "Read"],
  [/^(bash|shell|run_terminal_cmd|execute|exec|terminal|npm|pip|cargo|git|node|python|make|test)/, "Ran"],
  [/^(edit|search_replace|apply_patch|write|insert|create|append|delete|delete_file|rename)/, "Edited"],
  [/^(web_search|websearch|search_web|web_fetch|webfetch|fetch|http)/, "Searched"],
];
const OTHER_LABEL = "tools";

function toolVerb(name: string): string {
  const lower = name.toLowerCase();
  for (const [pattern, verb] of TOOL_VERBS) if (pattern.test(lower)) return verb;
  return OTHER_LABEL;
}

function summarizeTools(tools: ToolItem[]): { summary: string; failed: number; running: number } {
  const counts = new Map<string, number>();
  let failed = 0;
  let running = 0;
  for (const tool of tools) {
    const verb = toolVerb(tool.toolName);
    counts.set(verb, (counts.get(verb) ?? 0) + 1);
    if (tool.status === "error") failed++;
    if (tool.status === "running") running++;
  }
  const summary = [...counts.entries()]
    .map(([verb, count]) => (verb === OTHER_LABEL ? `${count} tools` : `${verb} ${count}`))
    .join(" · ");
  return { summary, failed, running };
}

function ToolGroup({ tools }: { tools: ToolItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const { summary, failed, running } = summarizeTools(tools);
  const statusParts = [failed > 0 && `${failed} failed`, running > 0 && `${running} running`].filter(Boolean) as string[];
  const label = expanded ? "Collapse tools" : `Expand ${tools.length} ${tools.length === 1 ? "tool" : "tools"}`;
  const toggle = () => setExpanded((value) => !value);

  return (
    <div className="tool-group">
      <div
        className="timeline-item-heading toggleable"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={label}
        onClick={toggle}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }}
      >
        <strong>{summary}</strong>
        <AppIcon name="chevronRight" size="xs" className={`timeline-chevron ${expanded ? "open" : ""}`} />
        {statusParts.length > 0 && <span className={`timeline-status ${failed > 0 ? "failed" : ""}`}>{statusParts.join(" · ")}</span>}
      </div>
      {expanded && tools.map((tool) => <TimelineItemView key={tool.toolCallId || tool.id} item={tool} />)}
    </div>
  );
}

const TOOL_PREVIEW_KEYS = ["command", "pattern", "path", "file", "url", "query", "glob", "directory", "name"];

/**
 * MCP-backed tools surface as the adapter's unified proxy tool (`mcp`) or as
 * prefixed direct tools (`mcp__<server>__<tool>`). Light annotation only —
 * no data-flow changes.
 */
function isMcpTool(name: string): boolean {
  return name === "mcp" || name.startsWith("mcp__") || name.startsWith("mcp_");
}

/** Extract a one-line human summary from a tool call's input. */
function toolPreview(input: string): string {
  const text = input.trim();
  if (!text) return "";
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const key of TOOL_PREVIEW_KEYS) {
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

function TimelineItemView({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((value) => !value);

  if (item.kind === "tool") {
    const preview = toolPreview(item.input) || toolPreview(item.output ?? "");
    const hasInput = item.input.trim() !== "";
    const hasOutput = Boolean(item.output && item.output.trim() !== "");
    return (
      <article className={`timeline-item tool-item ${item.status}`}>
        <div
          className="timeline-item-heading toggleable"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${item.toolName}`}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        >
          <strong className="tool-name">{item.toolName}</strong>
          {isMcpTool(item.toolName) && <span className="mcp-tag">via MCP</span>}
          <span className="tool-sep">·</span>
          <span className="tool-inline-preview">{preview || item.status}</span>
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

  if (item.kind === "thinking") return null;

  if (item.content.trim() === "") return null;

  if (item.kind === "user") {
    return (
      <article className="timeline-item message-item user">
        <div className="timeline-item-heading">
          <span className="timeline-icon user"><AppIcon name="user" size="sm" /></span>
          <strong>You</strong>
        </div>
        <div className="message-content"><Markdown content={item.content} /></div>
      </article>
    );
  }

  // assistant: markdown; notification / error: plain system text, no header — Codex style
  return (
    <article className={`timeline-item message-item ${item.kind}`}>
      {item.kind === "error" && <span className="message-error">error</span>}
      <div className="message-content">
        {item.kind === "assistant" ? <Markdown content={item.content} /> : item.content}
      </div>
    </article>
  );
}
