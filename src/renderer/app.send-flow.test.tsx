import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";
import { createInitialState, useAppStore } from "./state/appStore";
import type { PiApi, PiEvent } from "../shared/protocol";

function makeFakeApi() {
  const listeners = new Set<(event: PiEvent) => void>();
  const api: PiApi = {
    getSnapshot: vi.fn(async () => ({
      workspaceId: "local",
      session: useAppStore.getState().session,
      sessions: useAppStore.getState().sessions,
      projects: useAppStore.getState().projects ?? [],
      activeProjectId: useAppStore.getState().activeProjectId,
      timeline: useAppStore.getState().timeline,
      toolCalls: useAppStore.getState().toolCalls,
      queue: useAppStore.getState().queue,
      resources: { contextFiles: [], skills: [], promptTemplates: [], themes: [], extensions: [], packages: [] },
      diagnostics: { piVersion: "test", sequence: 0, messages: [], errors: [] },
      models: [],
      tools: [],
    })),
    chooseWorkspace: vi.fn(async () => "/tmp/project"),
    chooseFile: vi.fn(async () => undefined),
    startSession: vi.fn(async (options: { cwd: string; sessionPath?: string; sessionKey?: string }) => {
      listeners.forEach((listener) =>
        listener({
          eventId: "e1",
          workspaceId: "local",
          sessionId: "s1",
          sessionKey: options.sessionKey,
          timestamp: new Date().toISOString(),
          sequence: 1,
          type: "session_started",
          payload: { sessionId: "s1", cwd: options.cwd, sessionName: "Test session" },
        }),
      );
      return {
        ...useAppStore.getState(),
        session: {
          ...useAppStore.getState().session,
          sessionId: "s1",
          cwd: options.cwd,
          name: "Test session",
        },
        projects: [{ id: options.cwd, name: options.cwd.split("/").pop() ?? "project", path: options.cwd, updatedAt: new Date().toISOString() }],
        activeProjectId: options.cwd,
        sessions: [],
      };
    }),
    focusSession: vi.fn(async () => useAppStore.getState()),
    disposeSession: vi.fn(async () => undefined),
    listLiveSessions: vi.fn(async () => []),
    prompt: vi.fn(async (text: string) => {
      listeners.forEach((listener) =>
        listener({
          eventId: "e2",
          workspaceId: "local",
          sessionId: "s1",
          timestamp: new Date().toISOString(),
          sequence: 2,
          type: "user_message_created",
          payload: { messageId: "m1", content: text },
        }),
      );
    }),
    steer: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    undoFileChange: vi.fn(async () => undefined),
    openFile: vi.fn(async () => undefined),
    editFollowUp: vi.fn(async () => undefined),
    sendFollowUpNow: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    newSession: vi.fn(async () => undefined),
    resumeSession: vi.fn(async () => undefined),
    forkSession: vi.fn(async () => undefined),
    cloneSession: vi.fn(async () => undefined),
    importSession: vi.fn(async () => undefined),
    compact: vi.fn(async () => undefined),
    setThinkingLevel: vi.fn(async () => undefined),
    setTools: vi.fn(async () => undefined),
    setSkills: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
    executeCommand: vi.fn(async () => undefined),
    setModel: vi.fn(async () => undefined),
    getCommands: vi.fn(async () => []),
    getModels: vi.fn(async () => []),
    getTools: vi.fn(async () => []),
    getResources: vi.fn(async () => ({ contextFiles: [], skills: [], promptTemplates: [], themes: [], extensions: [], packages: [] })),
    getSessionTree: vi.fn(async () => []),
    resolveTrust: vi.fn(async () => undefined),
    getGitBranch: vi.fn(async () => "main"),
    listProjects: vi.fn(async () => useAppStore.getState().projects ?? []),
    listSessions: vi.fn(async () => useAppStore.getState().sessions ?? []),
    listProjectFiles: vi.fn(async () => [{ path: "src/App.tsx", isDir: false }, { path: "src", isDir: true }]),
    renameSession: vi.fn(async (_path: string, name: string) => ({ name })),
    deleteSession: vi.fn(async (_path: string) => ({ sessionPath: _path })),
    getSessionContext: vi.fn(async () => ({ name: "session", context: "" })),
    listProviders: vi.fn(async () => []),
    getProviderUsage: vi.fn(async () => ({
      providerId: "",
      session: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, contextTokens: 0, contextWindow: 0 },
      account: { mode: "unsupported" as const, providerId: "", reason: "no_adapter" as const },
    })),
    loginWithApiKey: vi.fn(async () => ({ name: "DeepSeek" })),
    logoutProvider: vi.fn(async () => undefined),
    loginWithOAuth: vi.fn(async () => ({ name: "Anthropic" })),
    answerAuthPrompt: vi.fn(async () => undefined),
    cancelProviderLogin: vi.fn(async () => undefined),
    openExternal: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => ({ projects: [], activeProjectId: undefined })),
    revealInFolder: vi.fn(async () => undefined),
    indexStatus: vi.fn(async () => ({ state: "idle" as const, filesIndexed: 0, symbolsIndexed: 0 })),
    indexRefresh: vi.fn(async () => ({ filesIndexed: 0, symbolsIndexed: 0, filesChanged: 0, filesDeleted: 0, durationMs: 0 })),
    indexSearch: vi.fn(async () => []),
    indexFindUsages: vi.fn(async () => []),
    getMcpConfig: vi.fn(async () => ({ cwd: "/tmp/project", sources: [], servers: [] })),
    setMcpServerEnabled: vi.fn(async () => ({ changed: false, path: "/tmp/project/.pi/mcp.json" })),
    importCursorMcp: vi.fn(async () => ({ imported: [], skipped: [] })),
    openMcpConfigFile: vi.fn(async () => undefined),
    addProject: vi.fn(async () => {
      const snapshot = await api.startSession({ cwd: "/tmp/project" });
      return {
        ...snapshot,
        projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
        activeProjectId: "/tmp/project",
      };
    }),
    selectProject: vi.fn(async (projectId: string) => api.startSession({ cwd: projectId })),
    setActiveProject: vi.fn(async (projectId: string) => ({
      projects: useAppStore.getState().projects ?? [],
      activeProjectId: projectId,
    })),
    onEvent: (listener: (event: PiEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { api };
}

describe("Pi Desktop end-to-end send flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("sends a prompt when a project is active", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, cwd: "/tmp/project" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
    });

    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "inspect the tests" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(api.startSession).toHaveBeenCalledWith({ cwd: "/tmp/project" }));
    await waitFor(() =>
      expect(api.prompt).toHaveBeenCalledWith("inspect the tests", expect.objectContaining({ sessionKey: expect.any(String) })),
    );
    await waitFor(() => expect(screen.getByText("inspect the tests")).toBeInTheDocument());

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("queues while running and can send a queued item now", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, sessionId: "s1", cwd: "/tmp/project", status: "running" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
      queue: { steering: [], followUp: ["inspect the result"] },
    });

    render(<App />);
    await waitFor(() => expect(screen.getByText("inspect the result")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "also check tests" } });
    fireEvent.click(screen.getByRole("button", { name: /queue follow-up/i }));
    await waitFor(() => expect(api.followUp).toHaveBeenCalledWith("also check tests", expect.objectContaining({ sessionKey: expect.any(String) })));

    fireEvent.click(screen.getByRole("button", { name: /send queued message 1 now/i }));
    await waitFor(() => expect(api.sendFollowUpNow).toHaveBeenCalledWith(0, expect.objectContaining({ sessionKey: expect.any(String) }), "inspect the result"));

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("⌘W closes (detaches) the active tab without aborting or disposing", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, cwd: "/tmp/project" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
    });

    render(<App />);
    // Send a message so a session tab gets seeded.
    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBeGreaterThan(0));

    // ⌘W closes the active tab…
    fireEvent.keyDown(window, { key: "w", metaKey: true });
    await waitFor(() => expect(screen.queryAllByRole("tab")).toHaveLength(0));

    // …and it is a detach: the host runtime is neither aborted nor disposed.
    expect(api.abort).not.toHaveBeenCalled();
    expect(api.disposeSession).not.toHaveBeenCalled();

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("⌘N starts a new session in the active project", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, cwd: "/tmp/project" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "n", metaKey: true });

    await waitFor(() =>
      expect(api.startSession).toHaveBeenCalledWith({ cwd: "/tmp/project", sessionKey: expect.any(String) }),
    );
    await waitFor(() => expect(api.newSession).toHaveBeenCalledWith({ sessionKey: expect.any(String) }));

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("closes an unused unpinned tab before opening the next session", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, cwd: "/tmp/project" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "n", metaKey: true });
    await waitFor(() => expect(api.newSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1));

    fireEvent.keyDown(window, { key: "n", metaKey: true });
    await waitFor(() => expect(api.newSession).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1));

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("opens a project when sending without one", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState(createInitialState());

    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(api.addProject).toHaveBeenCalled());
    await waitFor(() =>
      expect(api.prompt).toHaveBeenCalledWith("hello", expect.objectContaining({ sessionKey: expect.any(String) })),
    );

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("runs a built-in command selected from the slash picker", async () => {
    const { api } = makeFakeApi();
    vi.mocked(api.getCommands).mockResolvedValue([
      { id: "compact", name: "/compact", description: "Compact context", source: "builtin" },
    ]);
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      session: { ...createInitialState().session, sessionId: "s1", cwd: "/tmp/project" },
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
    });

    render(<App />);
    const input = screen.getByRole("textbox", { name: /message/i });
    fireEvent.change(input, { target: { value: "/compact" } });
    fireEvent.click(await screen.findByRole("option", { name: /compact/i }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(api.executeCommand).toHaveBeenCalledWith("/compact", ""));
    expect(api.prompt).not.toHaveBeenCalled();

    delete (window as unknown as { pi?: PiApi }).pi;
  });

  test("shows project tree with nested sessions", async () => {
    const { api } = makeFakeApi();
    (window as unknown as { pi: PiApi }).pi = api;
    useAppStore.setState({
      ...createInitialState(),
      projects: [{ id: "/tmp/project", name: "project", path: "/tmp/project", updatedAt: new Date().toISOString() }],
      activeProjectId: "/tmp/project",
      sessions: [{ sessionId: "s1", cwd: "/tmp/project", name: "First session", status: "idle", model: "", thinkingLevel: "medium", messageCount: 1, updatedAt: new Date().toISOString(), sessionFile: "/tmp/a.jsonl" }],
    });

    render(<App />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getAllByText("project").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("First session")).toBeInTheDocument());
    expect(screen.getByRole("searchbox", { name: /search sessions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select project project" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("button", { name: /new session in project/i }).length).toBeGreaterThan(0);

    delete (window as unknown as { pi?: PiApi }).pi;
  });
});
