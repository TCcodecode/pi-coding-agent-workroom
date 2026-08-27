import { describe, expect, test } from "vitest";
import type { TimelineItem } from "../../shared/protocol";
import {
  groupTimelineTools,
  thinkingSummary,
  type ToolGroup,
} from "./toolPresentation";

function bash(id: string, command: string): TimelineItem {
  return {
    id,
    kind: "tool",
    toolCallId: id,
    toolName: "bash",
    input: JSON.stringify({ command }),
    status: "completed",
  };
}

function thinking(id: string, content: string, status: "completed" | "streaming" = "completed"): TimelineItem {
  return { id, kind: "thinking", content, status };
}

describe("groupTimelineTools", () => {
  test("treats thinking as a hard break instead of absorbing it into a tool group", () => {
    const entries = groupTimelineTools([
      bash("bash-1", "ls"),
      thinking("think-1", "next I will inspect pwd"),
      bash("bash-2", "pwd"),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual(["tool", "thinking", "tool"]);
  });

  test("still groups consecutive completed bash calls when nothing interrupts them", () => {
    const entries = groupTimelineTools([
      bash("bash-1", "ls -la"),
      bash("bash-2", "pwd"),
      bash("bash-3", "cd /tmp"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "toolGroup",
      category: "shell",
      items: [expect.objectContaining({ id: "bash-1" }), expect.objectContaining({ id: "bash-2" }), expect.objectContaining({ id: "bash-3" })],
    });
    expect((entries[0] as ToolGroup).items).toHaveLength(3);
  });

  test("does not group tools across an assistant message", () => {
    const entries = groupTimelineTools([
      bash("bash-1", "a"),
      { id: "a1", kind: "assistant", content: "checking", status: "completed" },
      bash("bash-2", "b"),
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(["tool", "assistant", "tool"]);
  });

  test("keeps streaming thinking as its own row", () => {
    const entries = groupTimelineTools([
      bash("bash-1", "ls"),
      thinking("think-1", "still going", "streaming"),
      bash("bash-2", "pwd"),
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(["tool", "thinking", "tool"]);
  });
});

describe("thinkingSummary", () => {
  test("uses the first line after thinking settles", () => {
    expect(thinkingSummary("First I inspect.\nThen I edit.")).toBe("First I inspect.");
  });

  test("uses the last non-blank line while thinking is streaming", () => {
    expect(thinkingSummary("First I inspect.\nThen I edit.\n", { live: true })).toBe("Then I edit.");
  });
});
