import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutKeys } from "./ShortcutKeys";

describe("ShortcutKeys", () => {
  it("renders platform-specific individual key tokens", () => {
    const view = render(<ShortcutKeys keys={["mod", "B"]} platform="mac" label="Toggle inspector" />);

    expect(screen.getByLabelText("Toggle inspector: Command B")).toBeInTheDocument();
    expect(view.container.querySelectorAll("kbd")).toHaveLength(2);
    expect(screen.getByText("⌘")).toBeInTheDocument();

    view.rerender(<ShortcutKeys keys={["mod", "B"]} platform="windows" label="Toggle inspector" />);
    expect(screen.getByLabelText("Toggle inspector: Control B")).toBeInTheDocument();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
  });
});
