import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  SessionManager,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { sessionTodoExtension } from "@pi-desk/session-todo";
import { createMcpBridgeFactory } from "@pi-desk/mcp-bridge";
import type { McpStatusSnapshot } from "@pi-desk/mcp-bridge";
import type { SessionTodoItem } from "../../shared/protocol.js";
import { HttpWorkbenchStore } from "../http/store.js";
import { registerHttpWorkbenchTools } from "../http/extension.js";
import { registerReplyLanguage } from "./replyLanguage.js";
import { openSessionManagerAsync } from "./sessionOpen.js";
import type { PiRuntimeLike } from "./types.js";

export interface CreateSdkRuntimeOptions {
  cwd: string;
  sessionPath?: string;
  agentDir: string;
  httpWorkbench?: HttpWorkbenchStore;
  applyTodosFromBranch: (todos: SessionTodoItem[], sessionManager: unknown) => void;
  applyMcpStatus: (snapshot: McpStatusSnapshot) => void;
}

export async function createSdkRuntime(options: CreateSdkRuntimeOptions): Promise<PiRuntimeLike> {
  const sessionManager = options.sessionPath
    ? await openSessionManagerAsync(options.sessionPath, options.cwd)
    : SessionManager.create(options.cwd);
  const createRuntime = async ({ cwd, agentDir, sessionManager: manager, sessionStartEvent }: { cwd: string; agentDir: string; sessionManager: SessionManager; sessionStartEvent?: unknown }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      resourceLoaderOptions: {
        extensionFactories: [
          {
            name: "reply-language",
            factory: (pi) => registerReplyLanguage(pi),
          },
          {
            name: "session-todo",
            factory: (pi) =>
              sessionTodoExtension(pi, (todos, sessionManager) =>
                options.applyTodosFromBranch(todos, sessionManager),
              ),
          },
          { name: "mcp", factory: createMcpBridgeFactory((snapshot) => options.applyMcpStatus(snapshot)) },
          ...(options.httpWorkbench
            ? [{ name: "http-workbench", factory: (pi: ExtensionAPI) => registerHttpWorkbenchTools(pi, options.httpWorkbench!) }]
            : []),
        ],
      },
    });
    const result = await createAgentSessionFromServices({
      services,
      sessionManager: manager,
      sessionStartEvent: sessionStartEvent as never,
    });
    result.session.setActiveToolsByName(result.session.getAllTools().map((tool) => tool.name));
    return { ...result, services, diagnostics: services.diagnostics };
  };
  return createAgentSessionRuntime(createRuntime, {
    cwd: options.cwd,
    agentDir: options.agentDir,
    sessionManager,
  }) as unknown as Promise<PiRuntimeLike>;
}
