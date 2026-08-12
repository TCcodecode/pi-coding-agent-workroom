export type SessionStatus = "idle" | "running" | "awaiting_approval" | "completed" | "error" | "archived";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type AgentMode = "plan" | "execute";
export type PlanStatus = "draft" | "ready" | "executing" | "superseded" | "completed";

export interface AgentProfile {
  modelKey?: string;
  thinkingLevel: ThinkingLevel;
}

export interface PlanArtifactSummary {
  id: string;
  path: string;
  title: string;
  status: PlanStatus;
  updatedAt: string;
  revision: string;
  /** Session identity that owns this plan artifact. */
  sourceSession?: string;
}

export interface SessionModeState {
  mode: AgentMode;
  planProfile: AgentProfile;
  executeProfile: AgentProfile;
  activePlan?: PlanArtifactSummary;
}

export interface SessionStartedPayload {
  sessionId: string;
  cwd: string;
  sessionName?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface SessionSummary {
  sessionId: string;
  cwd: string;
  name: string;
  status: SessionStatus;
  model: string;
  thinkingLevel: ThinkingLevel;
  sessionFile?: string;
  messageCount: number;
  updatedAt: string;
  modeState?: SessionModeState;
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
  /** Stable application-owned identity for project-scoped assets. */
  projectUid?: string;
}

export type HttpTreeNodeKind = "folder" | "file" | "environment" | "history" | "response";

export interface HttpTreeNode {
  id: string;
  name: string;
  kind: HttpTreeNodeKind;
  relativePath: string;
  children?: HttpTreeNode[];
  runCount?: number;
  /** Metadata for a virtual response artifact shown beneath Run History. */
  historyScopePath?: string;
  runId?: string;
  requestId?: string;
  status?: number;
}

export interface HttpEnvironment {
  name: string;
  relativePath: string;
  variables: Record<string, string>;
  updatedAt: string;
}

export interface HttpEnvironmentDocument {
  name: string;
  relativePath: string;
  content: string;
}

export interface HttpWorkspaceSnapshot {
  projectUid: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  tree: HttpTreeNode[];
  environments: HttpEnvironment[];
}

export interface HttpRequestRunResult {
  id: string;
  filePath: string;
  requestName: string;
  method: string;
  url: string;
  /** Raw request block captured when the run was executed. */
  requestSource?: string;
  /** Source line where the request starts, used for the response inlay. */
  requestLine?: number;
  /** Saved response output filename within the run artifact directory. */
  responseFileName?: string;
  status?: number;
  ok: boolean;
  durationMs: number;
  response?: string;
  headers?: Record<string, string>;
  error?: string;
}

export interface HttpRunRecord {
  id: string;
  scopePath: string;
  scopeName: string;
  projectId: string;
  environment: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  requestCount: number;
  passedCount: number;
  failedCount: number;
  /** Present when a single request line was executed from an HTTP file. */
  requestLine?: number;
  requests: HttpRequestRunResult[];
}

export interface HttpApi {
  workspace(projectId: string): Promise<HttpWorkspaceSnapshot>;
  readFile(projectId: string, relativePath: string): Promise<{ path: string; content: string }>;
  saveFile(projectId: string, relativePath: string, content: string): Promise<void>;
  readEnvironment(projectId: string, relativePath: string): Promise<HttpEnvironmentDocument>;
  saveEnvironment(projectId: string, relativePath: string, content: string): Promise<void>;
  createFolder(projectId: string, parentPath: string, name: string): Promise<HttpWorkspaceSnapshot>;
  createFile(projectId: string, parentPath: string, name: string): Promise<{ path: string; content: string; workspace: HttpWorkspaceSnapshot }>;
  createEnvironment(projectId: string, name: string): Promise<HttpWorkspaceSnapshot>;
  listRuns(projectId: string, scopePath: string): Promise<HttpRunRecord[]>;
  readRun(projectId: string, scopePath: string, runId: string): Promise<HttpRunRecord>;
  readResponse(projectId: string, scopePath: string, runId: string, requestId: string): Promise<HttpRequestRunResult>;
  deleteRun(projectId: string, scopePath: string, runId: string): Promise<HttpWorkspaceSnapshot>;
  deleteResponse(projectId: string, scopePath: string, runId: string, requestId: string): Promise<HttpWorkspaceSnapshot>;
  deleteRunHistory(projectId: string, scopePath: string): Promise<HttpWorkspaceSnapshot>;
  run(projectId: string, scopePath: string, environmentName?: string, requestLine?: number): Promise<HttpRunRecord>;
}

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TodoPriority = "high" | "medium" | "low";

/** OpenCode-style session checklist item (mirrored from todowrite/todoread). */
export interface SessionTodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

export interface SessionState {
  sessionId: string;
  cwd: string;
  name: string;
  status: SessionStatus;
  model: string;
  provider: string;
  thinkingLevel: ThinkingLevel;
  contextTokens: number;
  contextWindow: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  sessionFile?: string;
  /** Agent-maintained multi-step checklist for the active session. */
  todos?: SessionTodoItem[];
  /** Monotonic within-session revision used to reject stale snapshots. */
  todosRevision?: number;
  /** Optional for backwards-compatible snapshots from older Pi Desk runtimes. */
  modeState?: SessionModeState;
}

export type TimelineItem =
  | { id: string; kind: "user" | "assistant" | "thinking" | "notification" | "error"; content: string; status: "streaming" | "completed" | "error" }
  | { id: string; kind: "tool"; toolCallId: string; toolName: string; input: string; output?: string; status: "running" | "completed" | "error"; change?: FileChangeSummary };

export interface FileChangeSummary {
  path: string;
  additions: number;
  deletions: number;
  diff: string;
}

export interface ToolCallState {
  id: string;
  toolName: string;
  input: string;
  output?: string;
  status: "running" | "completed" | "error";
  change?: FileChangeSummary;
}

export interface PackageResourceCounts {
  extensions: number;
  skills: number;
  prompts: number;
  themes: number;
}

export interface ResourceSnapshot {
  contextFiles: Array<{ path: string; source: "global" | "parent" | "project" | "package"; loaded: boolean; error?: string }>;
  skills: Array<{ name: string; path: string; loaded: boolean; group?: string; source?: string; enabled?: boolean }>;
  promptTemplates: Array<{ name: string; path: string }>;
  themes: Array<{ name: string; path: string; active: boolean }>;
  extensions: Array<{ name: string; source: string; loaded: boolean; error?: string; pkgSource?: string }>;
  packages: Array<{
    name: string;
    source: string;
    enabled: boolean;
    /** Resources this package contributed (counts; full lists are in the top-level arrays). */
    resources?: PackageResourceCounts;
  }>;
  /** Live MCP server status (pi-mcp-adapter view). Absent when no session has reported yet. */
  mcp?: McpStatusSnapshotView;
}

/** Runtime status of a single MCP server (mirrors pi-mcp-adapter statuses). */
export type McpServerRuntimeStatus =
  | "connected"
  | "cached"
  | "failed"
  | "needs-auth"
  | "not-connected"
  | "disabled";

export interface McpServerStatusView {
  name: string;
  status: McpServerRuntimeStatus;
  toolCount: number;
  failedAgoSeconds?: number;
  disabled: boolean;
}

/** Renderer-safe MCP status snapshot; never contains secrets or command details. */
export interface McpStatusSnapshotView {
  version: number;
  servers: McpServerStatusView[];
  totalTools: number;
  connectedCount: number;
  disabledCount: number;
}

/** One standard mcp.json source file the desktop can read/write. */
export interface McpConfigSourceView {
  path: string;
  exists: boolean;
  serverCount: number;
}

/** Merged view of one configured MCP server (values stripped, no secrets). */
export interface McpServerConfigView {
  name: string;
  disabled: boolean;
  /** Highest-precedence source file that defines this server (empty if none). */
  source: string;
}

/** Merged MCP config for a workspace (file-merge mode, adapter precedence). */
export interface McpConfigView {
  cwd: string;
  sources: McpConfigSourceView[];
  servers: McpServerConfigView[];
}

export interface SessionTreeNode {
  id: string;
  label: string;
  kind: string;
  children: SessionTreeNode[];
}

export interface RuntimeDiagnostics {
  piVersion: string;
  sdkSessionId?: string;
  sessionFile?: string;
  sequence: number;
  messages: string[];
  errors: string[];
}

export interface PiCommand {
  id: string;
  name: string;
  description: string;
  source: "builtin" | "extension" | "prompt" | "skill";
  args?: string;
}

export interface ModelOption {
  id: string;
  provider: string;
  label: string;
  available: boolean;
  thinkingLevels: ThinkingLevel[];
}

/** Provider credential status for Settings → Providers (Pi /login /logout). */
export type ProviderAuthSource = "stored" | "environment" | "runtime" | "none";

export interface ProviderAuthStatus {
  id: string;
  name: string;
  configured: boolean;
  /** Where auth is coming from when configured. */
  source: ProviderAuthSource;
  /** Human label e.g. DEEPSEEK_API_KEY or "stored credential". */
  sourceLabel?: string;
  hasApiKeyLogin: boolean;
  hasOAuthLogin: boolean;
  /** True when a credential is stored in auth.json (logout can remove it). */
  canLogout: boolean;
  credentialType?: "api_key" | "oauth";
}

/** Local session token/cost breakdown (from Pi session stats). */
export interface SessionUsageDetail {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  contextTokens: number;
  contextWindow: number;
}

/**
 * Account-level usage from a provider adapter (balance, quota windows, …).
 * Secrets never appear in this payload.
 */
export type AccountUsage =
  | {
      mode: "prepaid_balance";
      providerId: string;
      currency: string;
      total: number;
      granted?: number;
      toppedUp?: number;
      isAvailable: boolean;
      fetchedAt: string;
      label?: string;
    }
  | {
      mode: "quota_window";
      providerId: string;
      label?: string;
      windows: Array<{
        id: string;
        label: string;
        used: number;
        limit: number;
        unit: "ratio" | "tokens" | "requests";
        resetsAt?: string;
      }>;
      fetchedAt: string;
    }
  | {
      mode: "unsupported";
      providerId: string;
      reason: "no_adapter" | "not_configured" | "oauth" | "fetch_failed" | "skipped";
      message?: string;
    };

export interface ProviderUsageSnapshot {
  providerId: string;
  session: SessionUsageDetail;
  account: AccountUsage;
}

/**
 * Interactive prompt surfaced during an account (OAuth) login, mirroring Pi's
 * AuthPrompt. `promptId` lets the renderer answer via answerAuthPrompt.
 */
export interface ProviderLoginPrompt {
  promptId: string;
  type: "text" | "secret" | "select" | "manual_code";
  message: string;
  placeholder?: string;
  options?: Array<{ id: string; label: string; description?: string }>;
}

/**
 * Progress event emitted during an account login. Mirrors Pi's AuthEvent plus
 * terminal `done`/`error` states and the prompt event the renderer must answer.
 */
export type ProviderLoginEvent =
  | { type: "prompt"; prompt: ProviderLoginPrompt }
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string; intervalSeconds?: number; expiresInSeconds?: number }
  | { type: "info"; message: string; links?: Array<{ url: string; label?: string }> }
  | { type: "progress"; message: string }
  | { type: "done"; name: string }
  | { type: "error"; message: string };

/** Renderer-side view of an in-flight (or just-finished) account login. */
export interface ProviderLoginState {
  status: "running" | "done" | "error";
  events: ProviderLoginEvent[];
}

export interface ToolOption {
  name: string;
  description: string;
  active: boolean;
  source: string;
}

import type { IndexStats, IndexStatus, SymbolHit, UsageHit } from "@pi-desk/code-index";

/**
 * Stable key for a live runtime slot; equals SessionTab.id in the renderer.
 * Conventions: `file:${absPath}` | `tmp:${uuid}` | `id:${sessionId}`
 */
export type SessionKey = string;

/** Live agent slot summary for sidebar merge (may exist without a working-set tab). */
export interface LiveSessionSummary {
  sessionKey: SessionKey;
  sessionId: string;
  sessionFile?: string;
  cwd: string;
  projectId: string;
  name: string;
  status: SessionStatus;
}

export interface SessionCommandOptions {
  sessionKey?: SessionKey;
}

export interface PiEventBase<TType extends string, TPayload> {
  eventId: string;
  workspaceId: string;
  sessionId?: string;
  /** Routes session-scoped events to the correct tab/view. */
  sessionKey?: SessionKey;
  timestamp: string;
  sequence: number;
  type: TType;
  payload: TPayload;
  raw?: unknown;
}

export type PiEvent =
  | PiEventBase<"session_started", SessionStartedPayload>
  | PiEventBase<"session_completed", { sessionId?: string; sessionName?: string }>
  | PiEventBase<"session_error", { message: string }>
  | PiEventBase<"user_message_created", { messageId: string; content: string }>
  | PiEventBase<"assistant_message_started", { messageId: string }>
  | PiEventBase<"assistant_message_delta", { messageId: string; delta: string }>
  | PiEventBase<"assistant_message_completed", { messageId: string }>
  | PiEventBase<"thinking_started", { messageId: string }>
  | PiEventBase<"thinking_delta", { messageId: string; delta: string }>
  | PiEventBase<"thinking_completed", { messageId: string }>
  | PiEventBase<"tool_call_started", { toolCallId: string; toolName: string; input: string }>
  | PiEventBase<"tool_call_delta", { toolCallId: string; delta: string }>
  | PiEventBase<"tool_call_completed", { toolCallId: string; result: string; isError: boolean; change?: FileChangeSummary }>
  | PiEventBase<"file_change_undone", { path: string }>
  | PiEventBase<"queue_updated", { steering: string[]; followUp: string[] }>
  | PiEventBase<"model_changed", { model: string; provider: string }>
  | PiEventBase<"thinking_level_changed", { level: ThinkingLevel }>
  | PiEventBase<"mode_changed", SessionModeState>
  | PiEventBase<"plan_artifact_changed", { plan?: PlanArtifactSummary; plans: PlanArtifactSummary[] }>
  | PiEventBase<"resource_snapshot", ResourceSnapshot>
  | PiEventBase<"diagnostics_updated", RuntimeDiagnostics>
  | PiEventBase<"notification_created", { message: string; kind?: "info" | "error" }>
  | PiEventBase<"agent_started", {}>
  | PiEventBase<"turn_started", {}>
  | PiEventBase<"turn_completed", {}>
  | PiEventBase<"compaction_started", {}>
  | PiEventBase<"compaction_completed", { summary?: string }>
  | PiEventBase<"auto_retry_started", {}>
  | PiEventBase<"auto_retry_completed", {}>
  | PiEventBase<"model_select", { model?: string; provider?: string }>
  | PiEventBase<"project_trust_requested", { cwd: string; hasProjectResources: boolean }>
  | PiEventBase<"project_trust_resolved", { cwd: string; trusted: boolean }>
  | PiEventBase<"session_name_changed", { name: string; sessionId?: string; sessionFile?: string }>
  | PiEventBase<"provider_login_event", { providerId: string; event: ProviderLoginEvent }>
  | PiEventBase<"index_status_changed", { status: IndexStatus; cwd: string }>
  | PiEventBase<"todos_updated", { todos: SessionTodoItem[]; revision?: number }>
  | PiEventBase<"mcp_status_updated", McpStatusSnapshotView>
  | PiEventBase<"session_key_remapped", { from: SessionKey; to: SessionKey }>
  | PiEventBase<"live_sessions_changed", { sessions: LiveSessionSummary[] }>;

export interface PiSnapshot {
  workspaceId: string;
  session: SessionState;
  sessions: SessionSummary[];
  projects?: ProjectSummary[];
  activeProjectId?: string;
  timeline: TimelineItem[];
  toolCalls: Record<string, ToolCallState>;
  queue: { steering: string[]; followUp: string[] };
  resources: ResourceSnapshot;
  diagnostics: RuntimeDiagnostics;
  models?: ModelOption[];
  tools?: ToolOption[];
  lastError?: string;
}

export interface ProjectFileEntry {
  path: string;
  isDir: boolean;
}

export interface PiApi {
  getSnapshot(): Promise<PiSnapshot>;
  chooseWorkspace(): Promise<string | undefined>;
  chooseFile(): Promise<string | undefined>;
  listProjectFiles(cwd?: string): Promise<ProjectFileEntry[]>;
  startSession(options: {
    cwd: string;
    sessionPath?: string;
    /** When set, open/reuse a live slot without disposing other sessions. */
    sessionKey?: SessionKey;
  }): Promise<PiSnapshot>;
  /** Focus an existing live session without aborting others. */
  focusSession(sessionKey: SessionKey): Promise<PiSnapshot>;
  /** Explicitly release a runtime (delete file / shutdown). Not used on tab close. */
  disposeSession(sessionKey: SessionKey): Promise<void>;
  /** All live agent slots (including those without a working-set tab). */
  listLiveSessions(): Promise<LiveSessionSummary[]>;
  prompt(text: string, opts?: SessionCommandOptions): Promise<void>;
  steer(text: string, opts?: SessionCommandOptions): Promise<void>;
  followUp(text: string, opts?: SessionCommandOptions): Promise<void>;
  /** Restore a file to its content before the current session first changed it. */
  undoFileChange(path: string, opts?: SessionCommandOptions): Promise<void>;
  editFollowUp(index: number, text: string, opts?: SessionCommandOptions, expectedText?: string): Promise<void>;
  sendFollowUpNow(index: number, opts?: SessionCommandOptions, expectedText?: string): Promise<void>;
  abort(opts?: SessionCommandOptions): Promise<void>;
  newSession(opts?: SessionCommandOptions): Promise<void>;
  resumeSession(sessionPath: string): Promise<PiSnapshot | void>;
  forkSession(entryId: string): Promise<void>;
  /** Duplicate the current session into a new session file (mirrors Pi /clone). */
  cloneSession(): Promise<void>;
  importSession(path: string, cwdOverride?: string): Promise<void>;
  compact(instructions?: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): Promise<void>;
  setMode?(mode: AgentMode, opts?: SessionCommandOptions): Promise<SessionModeState>;
  setModeProfile?(mode: AgentMode, profile: AgentProfile, opts?: SessionCommandOptions): Promise<SessionModeState>;
  listPlans?(opts?: SessionCommandOptions): Promise<PlanArtifactSummary[]>;
  readPlan?(planId: string, opts?: SessionCommandOptions): Promise<{ summary: PlanArtifactSummary; content: string }>;
  updatePlan?(planId: string, content: string, revision?: string, opts?: SessionCommandOptions): Promise<PlanArtifactSummary>;
  savePlan?(title: string, content: string, status?: PlanStatus, planId?: string, opts?: SessionCommandOptions): Promise<{ summary: PlanArtifactSummary; content: string }>;
  startExecution?(planId?: string, opts?: SessionCommandOptions): Promise<SessionModeState>;
  setTools(tools: string[]): Promise<void>;
  /** Persist skill enable/disable patterns (e.g. ["!superpowers"]) to settings.json and reload. */
  setSkills(patterns: string[]): Promise<void>;
  reload(): Promise<void>;
  executeCommand(name: string, args?: string): Promise<void>;
  setModel(model: string): Promise<void>;
  getCommands(): Promise<PiCommand[]>;
  getModels(): Promise<ModelOption[]>;
  getTools(): Promise<ToolOption[]>;
  getResources(): Promise<ResourceSnapshot>;
  getSessionTree(): Promise<SessionTreeNode[]>;
  resolveTrust(trusted: boolean): Promise<void>;
  getGitBranch(cwd?: string): Promise<string | undefined>;
  listProjects(): Promise<ProjectSummary[]>;
  /** Opens a folder (if path omitted), registers it as a project, starts a session, returns full snapshot. */
  addProject(path?: string): Promise<PiSnapshot | undefined>;
  selectProject(projectId: string): Promise<PiSnapshot>;
  /**
   * Mark a project as the active target for New session / defaults.
   * Does not start or switch the Pi runtime session.
   */
  setActiveProject(projectId: string): Promise<{ projects: ProjectSummary[]; activeProjectId?: string }>;
  /** Remove project from the desktop list only (does not delete session JSONL files). */
  removeProject(projectId: string): Promise<{ projects: ProjectSummary[]; activeProjectId?: string }>;
  /** Reveal a file or folder in the OS file manager. */
  revealInFolder(path: string): Promise<void>;
  /** Open a project file in VS Code, or let the user choose an application. */
  openFile(path: string): Promise<void>;
  listSessions(cwd?: string): Promise<SessionSummary[]>;
  /** Rename a session (by session file path). Returns the resolved display name. */
  renameSession(sessionPath: string, name: string): Promise<{ name: string }>;
  /** Delete a session file permanently. Returns the deleted session's file path. */
  deleteSession(sessionPath: string): Promise<{ sessionPath: string }>;
  /** Extract the question/answer text from a session file (tool calls and thinking filtered out). */
  getSessionContext(sessionPath: string): Promise<{ name: string; context: string }>;
  /** List providers + auth status (for Settings → Providers). */
  listProviders(): Promise<ProviderAuthStatus[]>;
  /**
   * Session token/cost + optional account balance/quota from a provider adapter.
   * `force` bypasses the balance cache (e.g. click-to-refresh).
   */
  getProviderUsage(options?: { force?: boolean }): Promise<ProviderUsageSnapshot>;
  /** Save an API key via Pi modelRuntime.login (same as /login). */
  loginWithApiKey(providerId: string, apiKey: string): Promise<{ name: string }>;
  /** Remove stored credential via Pi modelRuntime.logout (same as /logout). */
  logoutProvider(providerId: string): Promise<void>;
  /**
   * Start an account (OAuth) login via Pi modelRuntime.login (same as /login).
   * Progress and interactive prompts arrive as provider_login_event events;
   * answer prompts with answerAuthPrompt and cancel with cancelProviderLogin.
   */
  loginWithOAuth(providerId: string): Promise<{ name: string }>;
  /** Answer a pending interactive prompt surfaced during an account login. */
  answerAuthPrompt(promptId: string, answer: string): Promise<void>;
  /** Cancel an in-flight account login for a provider. */
  cancelProviderLogin(providerId: string): Promise<void>;
  /** Open a URL in the user's default browser (OAuth authorization links). */
  openExternal(url: string): Promise<void>;
  /** Get the current code-index status for a workspace. */
  indexStatus(cwd: string): Promise<IndexStatus>;
  /** Incrementally re-scan and re-index changed files, then report status. */
  indexRefresh(cwd: string): Promise<IndexStats>;
  /** Search symbols in the code-index. */
  indexSearch(cwd: string, query: string, opts?: { limit?: number }): Promise<SymbolHit[]>;
  /** Find usages of a symbol in the code-index. */
  indexFindUsages(cwd: string, qualified: string, opts?: { kind?: string }): Promise<UsageHit[]>;
  /** Read the merged MCP config for the current workspace (server values stripped). */
  getMcpConfig(cwd?: string): Promise<McpConfigView>;
  /** Enable/disable an MCP server by writing the project override and reloading the runtime. */
  setMcpServerEnabled(name: string, enabled: boolean): Promise<{ changed: boolean; path: string }>;
  /** Copy servers from Cursor's ~/.cursor/mcp.json into the project override and reload. */
  importCursorMcp(): Promise<{ imported: string[]; skipped: string[] }>;
  /** Open the project MCP override file (.pi/mcp.json) in the default editor. */
  openMcpConfigFile(cwd?: string): Promise<void>;
  http?: HttpApi;
  onEvent(listener: (event: PiEvent) => void): () => void;
}

declare global {
  interface Window {
    pi: PiApi;
  }
}
