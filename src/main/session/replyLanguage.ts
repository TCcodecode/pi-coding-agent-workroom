import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const REPLY_LANGUAGE_GUIDANCE = `
Reply to the user in the same language they used in this turn. Keep code, identifiers, file paths, commands, and API names in their original form. Do not translate existing repository comments or strings unless asked.
`.trim();

export function registerReplyLanguage(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (event) => ({
    systemPrompt: event.systemPrompt ? `${event.systemPrompt}\n\n${REPLY_LANGUAGE_GUIDANCE}` : REPLY_LANGUAGE_GUIDANCE,
  }));
}
