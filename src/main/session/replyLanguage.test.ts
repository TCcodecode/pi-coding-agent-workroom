import { describe, expect, test, vi } from "vitest";
import { registerReplyLanguage } from "./replyLanguage.js";

describe("reply language guidance", () => {
  test("appends match-user-language guidance to the system prompt", () => {
    const pi = { on: vi.fn(), registerTool: vi.fn() };
    registerReplyLanguage(pi as never);

    const handler = pi.on.mock.calls.find(([event]) => event === "before_agent_start")?.[1] as
      | ((event: { systemPrompt?: string }) => { systemPrompt: string })
      | undefined;
    expect(handler).toBeDefined();
    const prompt = handler!({ systemPrompt: "base prompt" }).systemPrompt;
    expect(prompt).toContain("base prompt");
    expect(prompt).toContain("same language they used in this turn");
    expect(prompt).toContain("Keep code, identifiers, file paths, commands, and API names");
    expect(handler!({}).systemPrompt).toContain("same language they used in this turn");
  });
});
