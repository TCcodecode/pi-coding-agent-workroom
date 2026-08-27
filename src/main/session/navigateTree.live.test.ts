import { afterEach, describe, expect, test } from "vitest";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { PiHost } from "./host.js";
import type { PiRuntimeLike, PiSessionLike } from "./types.js";

function assistantMessage(text: string) {
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    api: "openai",
    provider: "openai",
    model: "gpt-4o",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop" as const,
    timestamp: Date.now(),
  };
}

describe("PiHost.navigateTree against a real AgentSession", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    dispose = undefined;
  });

  test("navigating the first user prompt clears the active path and returns the text", async () => {
    const manager = SessionManager.inMemory();
    const firstId = manager.appendMessage({ role: "user", content: "first prompt", timestamp: Date.now() });
    manager.appendMessage(assistantMessage("ok first"));
    manager.appendMessage({ role: "user", content: "second prompt", timestamp: Date.now() });
    manager.appendMessage(assistantMessage("ok second"));

    const { session } = await createAgentSession({ sessionManager: manager, tools: [] });
    dispose = () => session.dispose();

    const runtime: PiRuntimeLike = {
      session: session as unknown as PiSessionLike,
      cwd: process.cwd(),
      switchSession: async () => ({ cancelled: false }),
      newSession: async () => ({ cancelled: false }),
      fork: async () => ({ cancelled: false }),
      importFromJsonl: async () => ({ cancelled: false }),
      dispose: async () => session.dispose(),
    };
    const host = new PiHost({ workspaceId: "try-rewind", runtime });

    const before = host.snapshot({ tailTurns: Number.POSITIVE_INFINITY });
    expect(
      before.timeline.flatMap((item) => (item.kind === "user" ? [item.content] : [])),
    ).toEqual([
      "first prompt",
      "second prompt",
    ]);
    const firstUser = before.timeline.find((item) => item.kind === "user" && item.content === "first prompt");
    expect(firstUser?.kind === "user" ? firstUser.entryId : undefined).toBe(firstId);

    const result = await host.navigateTree(firstId);

    expect(result.cancelled).toBe(false);
    expect(result.editorText).toBe("first prompt");
    expect(result.snapshot.timeline.filter((item) => item.kind === "user")).toEqual([]);
    expect(result.snapshot.timeline.map((item) => item.kind)).not.toContain("assistant");
  });
});
