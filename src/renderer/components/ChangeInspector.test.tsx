import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ChangeInspector } from "./ChangeInspector";

const changes = [
  { path: "src/App.tsx", additions: 18, deletions: 4, diff: "@@\n-old\n+new" },
  { path: "src/components/SessionSidebar.tsx", additions: 12, deletions: 0, diff: "@@\n+sidebar" },
  { path: "src/components/SessionTabBar.tsx", additions: 2, deletions: 2, diff: "@@\n-old-tab\n+new-tab" },
];

describe("ChangeInspector", () => {
  test("shows every changed file in the current-session tree and opens the selected diff", () => {
    const onSelect = vi.fn();
    const onOpenFile = vi.fn();
    render(
      <ChangeInspector
        changes={changes}
        selectedPath="src/App.tsx"
        onSelect={onSelect}
        onOpenFile={onOpenFile}
        onOpenInspector={vi.fn()}
      />,
    );

    expect(screen.getByText("THIS SESSION")).toBeInTheDocument();
    expect(screen.getByText("src/App.tsx")).toBeInTheDocument();
    expect(screen.getByText("SessionSidebar.tsx")).toBeInTheDocument();
    expect(screen.getByText("SessionTabBar.tsx")).toBeInTheDocument();
    expect(screen.getByLabelText("Diff for src/App.tsx")).toHaveTextContent("+new");

    fireEvent.click(screen.getByRole("button", { name: "Open change src/components/SessionSidebar.tsx" }));
    expect(onSelect).toHaveBeenCalledWith("src/components/SessionSidebar.tsx");
    fireEvent.click(screen.getByRole("button", { name: "Open change src/App.tsx" }), { ctrlKey: true });
    expect(onOpenFile).toHaveBeenCalledWith("src/App.tsx");
  });

  test("marks a file reviewed and lets the reviewer reopen its collapsed diff", () => {
    render(
      <ChangeInspector
        changes={changes}
        selectedPath="src/App.tsx"
        onSelect={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Mark src/App.tsx as reviewed" }));
    expect(screen.queryByLabelText("Diff for src/App.tsx")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show diff for src/App.tsx" }));
    expect(screen.getByLabelText("Diff for src/App.tsx")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark src/App.tsx as reviewed" })).not.toBeChecked();
  });

  test("clicking the selected file row toggles its diff", () => {
    render(
      <ChangeInspector
        changes={changes}
        selectedPath="src/App.tsx"
        onSelect={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    );

    const file = screen.getByRole("button", { name: "Open change src/App.tsx" });
    expect(screen.getByLabelText("Diff for src/App.tsx")).toBeInTheDocument();
    fireEvent.click(file);
    expect(screen.queryByLabelText("Diff for src/App.tsx")).not.toBeInTheDocument();
    fireEvent.click(file);
    expect(screen.getByLabelText("Diff for src/App.tsx")).toBeInTheDocument();
  });

  test("closes the changes panel from its header", () => {
    const onClose = vi.fn();
    render(
      <ChangeInspector
        changes={changes}
        selectedPath="src/App.tsx"
        onSelect={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenInspector={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close changes" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
