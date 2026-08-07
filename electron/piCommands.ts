import type { PiCommand } from "../src/shared/protocol.js";

// Desktop whitelist: only commands that (a) are implemented in PiHost.executeCommand
// and (b) have no dedicated GUI flow. Everything else lives in native UI:
// fork → Session tree dialog, clone → context menu, new/name/session/tree →
// sidebar + timeline, settings/login/logout/trust/hotkeys → dialogs.
export const BUILTIN_PI_COMMANDS: PiCommand[] = [
  ["compact", "Compact the current context"],
  ["export", "Export the current session"],
  ["copy", "Copy the last assistant response"],
  ["reload", "Reload Pi resources"],
].map(([name, description]) => ({ id: name, name: `/${name}`, description, source: "builtin" }));

const HIDDEN_COMMAND_IDS = new Set(["quit", "exit"]);

export function mergePiCommands(extensionCommands: Array<{ name: string; description?: string; source?: string }>): PiCommand[] {
  const extensions = extensionCommands
    .map((command) => ({
      id: command.name.replace(/^\//, ""),
      name: command.name.startsWith("/") ? command.name : `/${command.name}`,
      description: command.description ?? "Extension command",
      source: "extension" as const,
    }))
    .filter((command) => !HIDDEN_COMMAND_IDS.has(command.id) && !BUILTIN_PI_COMMANDS.some((builtin) => builtin.id === command.id));
  return [...BUILTIN_PI_COMMANDS, ...extensions];
}
