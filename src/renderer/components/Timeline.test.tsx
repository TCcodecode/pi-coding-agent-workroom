import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { TimelineItem } from "../../shared/protocol";
import { Timeline } from "./Timeline";

const expandActivity = () => fireEvent.click(screen.getByRole("button", { name: /expand agent activity/i }));

describe("Timeline", () => {
  test("shows a file change summary below the edited turn", () => {
    const onReviewChanges = vi.fn();
    const items: TimelineItem[] = [
      { id: "assistant-1", kind: "assistant", content: "I fixed it.", status: "completed" },
      {
        id: "tool-1",
        kind: "tool",
        toolCallId: "tool-1",
        toolName: "edit",
        input: '{"path":"src/App.tsx"}',
        status: "completed",
        change: { path: "src/App.tsx", additions: 18, deletions: 4, diff: "@@\n-old\n+new" },
      },
      {
        id: "tool-2",
        kind: "tool",
        toolCallId: "tool-2",
        toolName: "write",
        input: '{"path":"src/App.test.tsx"}',
        status: "completed",
        change: { path: "src/App.test.tsx", additions: 12, deletions: 0, diff: "@@\n+test" },
      },
      {
        id: "tool-3",
        kind: "tool",
        toolCallId: "tool-3",
        toolName: "edit",
        input: '{"path":"src/components/One.tsx"}',
        status: "completed",
        change: { path: "src/components/One.tsx", additions: 1, deletions: 1, diff: "@@\n-old\n+new" },
      },
      {
        id: "tool-4",
        kind: "tool",
        toolCallId: "tool-4",
        toolName: "write",
        input: '{"path":"src/components/Two.tsx"}',
        status: "completed",
        change: { path: "src/components/Two.tsx", additions: 1, deletions: 0, diff: "@@\n+new" },
      },
    ];
    render(<Timeline items={items} onReviewChanges={onReviewChanges} />);

    const region = screen.getByRole("region", { name: "File changes" });
    expect(region).toHaveTextContent("Edited 4 files");
    expect(within(region).getByText("+32")).toBeInTheDocument();
    expect(within(region).getAllByText("-5")).toHaveLength(1);
    expect(within(region).getByText("src/App.tsx")).toBeInTheDocument();
    expect(within(region).getByText("src/App.test.tsx")).toBeInTheDocument();
    expect(within(region).getByText("src/components/One.tsx")).toBeInTheDocument();
    expect(within(region).queryByText("src/components/Two.tsx")).not.toBeInTheDocument();
    expect(screen.queryByRole("code")).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Review file changes" }));
    expect(onReviewChanges).toHaveBeenCalledWith("src/App.tsx");
    expect(screen.queryByRole("code")).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Show more files" }));
    expect(within(region).getByText("src/components/Two.tsx")).toBeInTheDocument();
  });

  test("merges repeated edits to the same file in one turn", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "edit", input: "{}", status: "completed", change: { path: "src/App.tsx", additions: 2, deletions: 1, diff: "@@\n-old\n+new" } },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "edit", input: "{}", status: "completed", change: { path: "src/App.tsx", additions: 3, deletions: 2, diff: "@@\n-old2\n+new2" } },
    ];
    render(<Timeline items={items} />);

    const region = screen.getByRole("region", { name: "File changes" });
    expect(region).toHaveTextContent("Edited 1 file");
    expect(within(region).getAllByText("+5")).toHaveLength(2);
    expect(within(region).getAllByText("-3")).toHaveLength(2);
    expect(within(region).getAllByText("src/App.tsx")).toHaveLength(1);
  });

  test("toggles the Review button and the selected file row", () => {
    const onReviewChanges = vi.fn();
    const onCloseReview = vi.fn();
    const items: TimelineItem[] = [
      {
        id: "tool-toggle",
        kind: "tool",
        toolCallId: "tool-toggle",
        toolName: "edit",
        input: "{}",
        status: "completed",
        change: { path: "src/App.tsx", additions: 1, deletions: 0, diff: "@@\n+new" },
      },
    ];

    const { rerender } = render(
      <Timeline items={items} onReviewChanges={onReviewChanges} reviewOpen selectedReviewPath="src/App.tsx" onCloseReview={onCloseReview} />,
    );
    const region = screen.getByRole("region", { name: "File changes" });
    fireEvent.click(within(region).getByRole("button", { name: "Review file changes" }));
    fireEvent.click(within(region).getByRole("button", { name: "Review src/App.tsx" }));
    expect(onCloseReview).toHaveBeenCalledTimes(2);

    rerender(<Timeline items={items} onReviewChanges={onReviewChanges} />);
    fireEvent.click(screen.getByRole("button", { name: "Review src/App.tsx" }));
    expect(onReviewChanges).toHaveBeenCalledWith("src/App.tsx");
  });

  test("shows Undo for a multi-file change summary", () => {
    const onUndoChanges = vi.fn();
    const items: TimelineItem[] = [
      { id: "tool-undo-1", kind: "tool", toolCallId: "tool-undo-1", toolName: "edit", input: "{}", status: "completed", change: { path: "src/App.tsx", additions: 1, deletions: 0, diff: "@@\n+new" } },
      { id: "tool-undo-2", kind: "tool", toolCallId: "tool-undo-2", toolName: "edit", input: "{}", status: "completed", change: { path: "src/styles.css", additions: 2, deletions: 1, diff: "@@\n-old\n+new" } },
    ];

    render(<Timeline items={items} onUndoChanges={onUndoChanges} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo file changes" }));
    expect(onUndoChanges).toHaveBeenCalledWith(["src/App.tsx", "src/styles.css"]);
  });

  test("uses a line icon for the empty state", () => {
    const { container } = render(<Timeline items={[]} />);

    expect(container.querySelector(".empty-glyph svg")).toBeInTheDocument();
    expect(container.textContent).not.toContain("π");
  });

  test("renders answer, folds tools into a summary line, expands on demand", () => {
    const items: TimelineItem[] = [
      { id: "assistant-1", kind: "assistant", content: "I found the issue.", status: "streaming" },
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "bash", input: "npm test\n--run", output: "passed", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("I found the issue.")).toBeInTheDocument();
    expect(screen.getByText("Ran 1")).toBeInTheDocument();
    expect(screen.queryByText("passed")).not.toBeInTheDocument();
    expandActivity();
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByText("npm test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expand bash/i }));
    expect(screen.getByText("passed")).toBeInTheDocument();
  });

  test("marks MCP-backed tools with a via-MCP tag, plain tools stay clean", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "mcp", input: '{"action":"call","tool":"list_todos"}', status: "completed" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "read", input: '{"path": "src/App.tsx"}', status: "completed" },
      { id: "tool-3", kind: "tool", toolCallId: "tool-3", toolName: "mcp__github__get_issue", input: '{"repo":"pi"}', status: "completed" },
    ];
    render(<Timeline items={items} />);

    expandActivity();
    fireEvent.click(screen.getByRole("button", { name: /expand 3 tools/i }));
    const tags = screen.getAllByText("via MCP");
    expect(tags).toHaveLength(2);
    expect(tags[0].closest(".tool-item")).toHaveTextContent("mcp");
    expect(tags[1].closest(".tool-item")).toHaveTextContent("mcp__github__get_issue");
    // Plain tools never get the tag.
    expect(screen.getByText("read").closest(".tool-item")).not.toHaveTextContent("via MCP");
  });

  test("empty assistant messages render nothing (no stray empty line)", () => {
    const items: TimelineItem[] = [
      { id: "assistant-1", kind: "assistant", content: "", status: "streaming" },
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "read", input: '{"path": "src/App.tsx"}', output: "line1\nline2", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.queryByText("Pi")).not.toBeInTheDocument();
    expect(screen.getByText("Read 1")).toBeInTheDocument();
    expandActivity();
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("src/App.tsx")).toBeInTheDocument();
  });

  test("different tools fold into one categorized summary", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "read", input: '{\n  "path": "src/App.tsx"\n}', output: "42 lines", status: "completed" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "bash", input: '{"command": "npm test -- --run"}', status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("Read 1 · Ran 1")).toBeInTheDocument();
    expect(screen.queryByText("src/App.tsx")).not.toBeInTheDocument();
    expandActivity();
    fireEvent.click(screen.getByRole("button", { name: /expand 2 tools/i }));
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByText("src/App.tsx")).toBeInTheDocument();
  });

  test("summary shows a red failed count when any tool errored", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "bash", input: "npm test", status: "completed" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "read", input: '{"path": "src/App.tsx"}', status: "error" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("Ran 1 · Read 1")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
  });

  test("active activity shows a fixed live window instead of the summary", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "bash", input: "npm test", status: "running" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "read", input: '{"path": "a.ts"}', status: "running" },
    ];
    render(<Timeline items={items} />);

    // anchor row + live tail line both carry the summary
    expect(screen.getAllByText("Ran 1 · Read 1")).toHaveLength(2);
    expect(screen.getByText("2 running")).toBeInTheDocument();
  });

  test("keeps the current turn live across thinking and tool status boundaries", () => {
    const items: TimelineItem[] = [
      { id: "thinking-1", kind: "thinking", content: "checking the plan", status: "completed" },
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "read", input: '{"path": "a.ts"}', status: "completed" },
    ];
    render(<Timeline items={items} sessionStatus="running" />);

    // The turn is still running even though this render is between two
    // individual activity events, so the live trace does not disappear.
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getAllByText("Read 1")).toHaveLength(2);
  });

  test("only the current running turn keeps its live trace", () => {
    const items: TimelineItem[] = [
      { id: "user-1", kind: "user", content: "First", status: "completed" },
      { id: "thinking-1", kind: "thinking", content: "first thought", status: "completed" },
      { id: "user-2", kind: "user", content: "Second", status: "completed" },
      { id: "thinking-2", kind: "thinking", content: "second thought", status: "completed" },
    ];
    render(<Timeline items={items} sessionStatus="running" />);

    const traces = document.querySelectorAll(".activity-trace");
    expect(traces).toHaveLength(1);
    expect(screen.queryByText("second thought")).not.toBeInTheDocument();
  });

  test("finished thinking collapses to a stub and shows content when expanded", () => {
    const items: TimelineItem[] = [
      { id: "thinking-1", kind: "thinking", content: "First I check the logs.\nThen I retry.", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText("First I check the logs.")).not.toBeInTheDocument();
    expandActivity();
    expect(screen.getByText(/Then I retry\./)).toBeInTheDocument();
  });

  test("streaming thinking appears in the live window and shows content when expanded", () => {
    const items: TimelineItem[] = [
      { id: "thinking-1", kind: "thinking", content: "line1\nline2\nline3\nline4\nline5", status: "streaming" },
    ];
    render(<Timeline items={items} />);

    // live window: the anchor stub + a "· Thinking" tail line, content hidden
    expect(screen.getAllByText("Thinking")).toHaveLength(2);
    expect(screen.queryByText(/line1/)).not.toBeInTheDocument();
    expandActivity();
    expect(screen.getByText(/line1/)).toBeInTheDocument();
    expect(screen.getByText(/line5/)).toBeInTheDocument();
  });

  test("user messages open a new turn, each with its own activity", () => {
    const items: TimelineItem[] = [
      { id: "user-1", kind: "user", content: "First question", status: "completed" },
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "read", input: '{"path": "a.ts"}', status: "completed" },
      { id: "user-2", kind: "user", content: "Second question", status: "completed" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "grep", input: '{"pattern": "foo"}', status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("First question")).toBeInTheDocument();
    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(screen.getAllByText("Read 1")).toHaveLength(2);
  });

  test("a tool call and its toolResult merge into one counted row", () => {
    const items: TimelineItem[] = [
      { id: "call-1", kind: "tool", toolCallId: "call-1", toolName: "bash", input: '{"command": "ls -la"}', status: "completed" },
      { id: "result-1", kind: "tool", toolCallId: "call-1", toolName: "bash", input: "", output: "total 4", status: "completed" },
      { id: "call-2", kind: "tool", toolCallId: "call-2", toolName: "bash", input: '{"command": "git status"}', status: "completed" },
      { id: "result-2", kind: "tool", toolCallId: "call-2", toolName: "bash", input: "", output: "nothing to commit", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("Ran 2")).toBeInTheDocument();
    expandActivity();
    fireEvent.click(screen.getByRole("button", { name: /expand 2 tools/i }));
    expect(screen.getByText("ls -la")).toBeInTheDocument();
    expect(screen.getByText("git status")).toBeInTheDocument();
    expect(screen.queryByText("total 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /expand bash/i })[0]);
    expect(screen.getByText("total 4")).toBeInTheDocument();
  });

  test("many thinking blocks share one summary and expand into a trace", () => {
    const items: TimelineItem[] = [
      { id: "thinking-1", kind: "thinking", content: "round one", status: "completed" },
      { id: "thinking-2", kind: "thinking", content: "round two", status: "completed" },
      { id: "thinking-3", kind: "thinking", content: "round three", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getAllByText("Thinking")).toHaveLength(1);
    expect(screen.queryByText("round one")).not.toBeInTheDocument();
    expandActivity();
    // header + inline thinking content, no per-block stubs
    expect(screen.getAllByText("Thinking")).toHaveLength(1);
    expect(screen.getByText("round one")).toBeInTheDocument();
    expect(screen.getByText("round three")).toBeInTheDocument();
  });

  test("assistant messages render markdown", () => {
    const items: TimelineItem[] = [
      { id: "assistant-1", kind: "assistant", content: "# Title\n\nSome **bold** and `code` here.", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  test("expanded activity collapses back to its summary", () => {
    const items: TimelineItem[] = [
      { id: "tool-1", kind: "tool", toolCallId: "tool-1", toolName: "read", input: '{"path": "a.ts"}', status: "completed" },
      { id: "tool-2", kind: "tool", toolCallId: "tool-2", toolName: "bash", input: "npm test", status: "completed" },
    ];
    render(<Timeline items={items} />);

    expect(screen.getByText("Read 1 · Ran 1")).toBeInTheDocument();
    expandActivity();
    fireEvent.click(screen.getByRole("button", { name: /expand 2 tools/i }));
    expect(screen.getByText("read")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse agent activity/i }));
    expect(screen.getByText("Read 1 · Ran 1")).toBeInTheDocument();
    expect(screen.queryByText("read")).not.toBeInTheDocument();
  });
});
