import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CompanionModelPicker } from "./ModelPicker";

const models = [
  { id: "deepseek-v4-flash", provider: "deepseek", label: "DeepSeek V4 Flash", available: true, thinkingLevels: ["medium" as const] },
  { id: "deepseek-v4", provider: "deepseek", label: "DeepSeek V4", available: true, thinkingLevels: ["medium" as const] },
];

describe("CompanionModelPicker", () => {
  test("shows the complete model name and selects from an anchored menu", () => {
    const onSelect = vi.fn();
    render(<CompanionModelPicker models={models} value="deepseek-v4-flash" onSelect={onSelect} />);

    const trigger = screen.getByRole("button", { name: /model, currently deepseek v4 flash/i });
    expect(trigger).toHaveTextContent("DeepSeek V4 Flash");
    fireEvent.click(trigger);

    expect(screen.getByRole("listbox", { name: "Models" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "DeepSeek V4" }));
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4");
    expect(screen.queryByRole("listbox", { name: "Models" })).not.toBeInTheDocument();
  });

  test("closes the menu with Escape", () => {
    render(<CompanionModelPicker models={models} value="deepseek-v4-flash" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /model, currently/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Models" })).not.toBeInTheDocument();
  });

  test("uses the first available model when the session has no selection", () => {
    const onSelect = vi.fn();
    render(<CompanionModelPicker models={models} value="" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /model, currently deepseek v4 flash/i })).toHaveTextContent("DeepSeek V4 Flash");
    fireEvent.click(screen.getByRole("button", { name: /model, currently deepseek v4 flash/i }));
    fireEvent.click(screen.getByRole("option", { name: "DeepSeek V4" }));
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4");
  });
});
