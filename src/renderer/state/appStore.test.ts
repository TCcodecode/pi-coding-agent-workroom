import { describe, expect, test } from "vitest";
import type { IndexStatus } from "@pi-desk/code-index";
import {
  createInitialState,
  reducePiEvent,
  useAppStore,
  type PiEvent,
} from "./appStore";

const event = <T extends PiEvent["type"]>(
  type: T,
  payload: Extract<PiEvent, { type: T }>["payload"],
): PiEvent => ({
  eventId: `${type}-1`,
  workspaceId: "workspace-1",
  sessionId: "session-1",
  timestamp: "2026-08-06T00:00:00.000Z",
  sequence: 1,
  type,
  payload,
} as PiEvent);

describe("reducePiEvent", () => {
  test("projects a session start and assistant stream into timeline state", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("session_started", {
      sessionId: "session-1",
      cwd: "/tmp/project",
      sessionName: "Refactor auth",
      model: "openai/gpt-5",
      thinkingLevel: "medium",
    }));
    state = reducePiEvent(state, event("assistant_message_started", { messageId: "message-1" }));
    state = reducePiEvent(state, event("assistant_message_delta", { messageId: "message-1", delta: "Hello" }));
    state = reducePiEvent(state, event("assistant_message_delta", { messageId: "message-1", delta: " Pi" }));
    state = reducePiEvent(state, event("assistant_message_completed", { messageId: "message-1" }));

    expect(state.session.sessionId).toBe("session-1");
    expect(state.session.cwd).toBe("/tmp/project");
    expect(state.session.model).toBe("openai/gpt-5");
    expect(state.timeline).toEqual([
      expect.objectContaining({ id: "message-1", kind: "assistant", content: "Hello Pi", status: "completed" }),
    ]);
  });

  test("keeps tool execution, queue, and diff state visible", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("tool_call_started", { toolCallId: "tool-1", toolName: "bash", input: "npm test" }));
    state = reducePiEvent(state, event("tool_call_delta", { toolCallId: "tool-1", delta: "running" }));
    state = reducePiEvent(state, event("tool_call_completed", { toolCallId: "tool-1", result: "passed", isError: false }));
    state = reducePiEvent(state, event("queue_updated", { steering: ["focus tests"], followUp: ["summarize"] }));

    expect(state.toolCalls["tool-1"]).toEqual(expect.objectContaining({ status: "completed", output: "passed" }));
    expect(state.queue).toEqual({ steering: ["focus tests"], followUp: ["summarize"] });
  });

  test("projects runtime changes and terminal errors", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("model_changed", { model: "anthropic/claude-sonnet", provider: "anthropic" }));
    state = reducePiEvent(state, event("thinking_level_changed", { level: "high" }));
    state = reducePiEvent(state, event("session_error", { message: "Provider unavailable" }));

    expect(state.session.model).toBe("anthropic/claude-sonnet");
    expect(state.session.thinkingLevel).toBe("high");
    expect(state.session.status).toBe("error");
    expect(state.lastError).toBe("Provider unavailable");
  });

  test("projects compaction lifecycle", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("compaction_started", {}));
    expect(state.session.status).toBe("running");
    state = reducePiEvent(state, event("compaction_completed", { summary: "done" }));
    expect(state.session.status).toBe("completed");
  });

  test("first user message becomes session title when still Untitled", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("session_started", {
      sessionId: "session-1",
      cwd: "/tmp/project",
      sessionName: "Untitled session",
      model: "m",
      thinkingLevel: "medium",
    }));
    state = reducePiEvent(state, event("user_message_created", {
      messageId: "u1",
      content: "Please fix the tab title refresh bug in the desktop app",
    }));
    expect(state.session.name).toBe("Please fix the tab title refresh bug in the desktop app");
  });

  test("session_name_changed updates active session and matching list entry without clearing timeline", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("session_started", {
      sessionId: "session-1",
      cwd: "/tmp/project",
      sessionName: "Old",
    }));
    state = {
      ...state,
      session: { ...state.session, sessionFile: "/tmp/session.jsonl" },
      sessions: [
        { sessionId: "session-1", cwd: "/tmp/project", name: "Old", status: "idle", model: "", thinkingLevel: "medium", sessionFile: "/tmp/session.jsonl", messageCount: 1, updatedAt: "2026-01-01" },
        { sessionId: "session-2", cwd: "/tmp/project", name: "Other", status: "idle", model: "", thinkingLevel: "medium", sessionFile: "/tmp/other.jsonl", messageCount: 0, updatedAt: "2026-01-01" },
      ],
      timeline: [{ id: "m1", kind: "user", content: "hi", status: "completed" }],
    };
    state = reducePiEvent(state, event("session_name_changed", {
      name: "New title",
      sessionId: "session-1",
      sessionFile: "/tmp/session.jsonl",
    }));

    expect(state.session.name).toBe("New title");
    expect(state.timeline).toHaveLength(1);
    expect(state.sessions[0].name).toBe("New title");
    expect(state.sessions[1].name).toBe("Other");
  });

  test("projects model selection events", () => {
    const state = reducePiEvent(createInitialState(), event("model_select", { model: "openai/gpt-5", provider: "openai" }));
    expect(state.session.model).toBe("openai/gpt-5");
    expect(state.session.provider).toBe("openai");
  });

  test("index_status_changed updates indexStatus in state", () => {
    const status: IndexStatus = { state: "indexing", filesIndexed: 42, symbolsIndexed: 100 };
    let state = createInitialState();
    expect(state.indexStatus).toBeNull();
    state = reducePiEvent(state, event("index_status_changed", { status, cwd: "/tmp/project" }));
    expect(state.indexStatus).toEqual(status);
  });

  test("todos_updated mirrors checklist onto session state", () => {
    let state = createInitialState();
    expect(state.session.todos).toEqual([]);
    state = reducePiEvent(
      state,
      event("todos_updated", {
        todos: [
          { id: "1", content: "Plan", status: "completed", priority: "high" },
          { id: "2", content: "Build", status: "in_progress", priority: "high" },
        ],
      }),
    );
    expect(state.session.todos).toEqual([
      { id: "1", content: "Plan", status: "completed", priority: "high" },
      { id: "2", content: "Build", status: "in_progress", priority: "high" },
    ]);
  });

  test("ignores an older todo revision", () => {
    let state = reducePiEvent(
      createInitialState(),
      event("todos_updated", {
        revision: 2,
        todos: [{ id: "new", content: "New", status: "in_progress", priority: "high" }],
      }),
    );
    state = reducePiEvent(
      state,
      event("todos_updated", {
        revision: 1,
        todos: [{ id: "old", content: "Old", status: "pending", priority: "low" }],
      }),
    );
    expect(state.session.todos).toEqual([
      { id: "new", content: "New", status: "in_progress", priority: "high" },
    ]);
    expect(state.session.todosRevision).toBe(2);
  });

  test("does not let a stale snapshot overwrite a newer todo event", () => {
    useAppStore.setState(createInitialState());
    useAppStore.getState().applyEvent(event("session_started", {
      sessionId: "session-1",
      cwd: "/tmp/project",
    }));
    useAppStore.getState().applyEvent(event("todos_updated", {
      revision: 2,
      todos: [{ id: "new", content: "New", status: "in_progress", priority: "high" }],
    }));
    useAppStore.getState().replaceSnapshot({
      ...useAppStore.getState(),
      session: {
        ...useAppStore.getState().session,
        todos: [{ id: "old", content: "Old", status: "pending", priority: "low" }],
        todosRevision: 1,
      },
    });
    expect(useAppStore.getState().session.todos).toEqual([
      { id: "new", content: "New", status: "in_progress", priority: "high" },
    ]);
  });

  test("tracks provider login progress, prompts, and terminal states", () => {
    let state = createInitialState();
    state = reducePiEvent(state, event("provider_login_event", {
      providerId: "anthropic",
      event: { type: "auth_url", url: "https://auth.example.com/start", instructions: "Authorize" },
    }));
    expect(state.providerLogins.anthropic.status).toBe("running");
    expect(state.providerLogins.anthropic.events).toHaveLength(1);

    state = reducePiEvent(state, event("provider_login_event", {
      providerId: "anthropic",
      event: {
        type: "prompt",
        prompt: { promptId: "login-1", type: "select", message: "How do you want to log in?", options: [{ id: "browser", label: "Browser login (default)" }] },
      },
    }));
    expect(state.providerLogins.anthropic.status).toBe("running");
    expect(state.providerLogins.anthropic.events).toHaveLength(2);
    expect(state.providerLogins.anthropic.events[1]).toEqual(expect.objectContaining({ type: "prompt" }));

    state = reducePiEvent(state, event("provider_login_event", {
      providerId: "anthropic",
      event: { type: "done", name: "Anthropic" },
    }));
    expect(state.providerLogins.anthropic.status).toBe("done");

    state = reducePiEvent(state, event("provider_login_event", {
      providerId: "openai",
      event: { type: "error", message: "Login cancelled" },
    }));
    expect(state.providerLogins.openai.status).toBe("error");
    expect(state.providerLogins.openai.events[0]).toEqual(expect.objectContaining({ type: "error" }));
  });

  test("merges MCP status snapshots into resources.mcp", () => {
    let state = createInitialState();
    expect(state.resources.mcp).toBeUndefined();

    state = reducePiEvent(state, event("mcp_status_updated", {
      version: 1,
      servers: [
        { name: "github", status: "connected", toolCount: 12, disabled: false },
        { name: "supabase", status: "failed", toolCount: 0, failedAgoSeconds: 30, disabled: false },
      ],
      totalTools: 12,
      connectedCount: 1,
      disabledCount: 0,
    }));

    expect(state.resources.mcp?.servers).toHaveLength(2);
    expect(state.resources.mcp?.servers[0]).toEqual(expect.objectContaining({ name: "github", status: "connected", toolCount: 12 }));
    expect(state.resources.mcp?.servers[1]).toEqual(expect.objectContaining({ name: "supabase", status: "failed", failedAgoSeconds: 30 }));
    expect(state.resources.mcp?.totalTools).toBe(12);

    // A later snapshot replaces the previous one rather than merging servers.
    state = reducePiEvent(state, event("mcp_status_updated", {
      version: 1,
      servers: [{ name: "github", status: "cached", toolCount: 12, disabled: false }],
      totalTools: 12,
      connectedCount: 0,
      disabledCount: 0,
    }));
    expect(state.resources.mcp?.servers).toHaveLength(1);
    expect(state.resources.mcp?.servers[0].status).toBe("cached");
  });
});
