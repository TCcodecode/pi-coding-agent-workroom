import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SessionTabBar } from "./SessionTabBar";
import type { SessionTab } from "../state/sessionTabs";

const tabs: SessionTab[] = [
  { id: "t1", sessionId: "s1", sessionFile: "/a.jsonl", projectId: "/tmp/alpha", title: "First", pinned: true },
  { id: "t2", sessionId: "s2", sessionFile: "/b.jsonl", projectId: "/tmp/beta", title: "Second" },
];

const projects = [
  { id: "/tmp/alpha", name: "alpha-app", path: "/tmp/alpha", updatedAt: "2026-08-08T00:00:00.000Z" },
  { id: "/tmp/beta", name: "beta-app", path: "/tmp/beta", updatedAt: "2026-08-08T00:00:00.000Z" },
];

describe("SessionTabBar", () => {
  test("removes the segmented capsule when only one tab is open", () => {
    render(
      <SessionTabBar
        tabs={[tabs[0]!]}
        activeTabId="t1"
        projects={projects}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    expect(document.querySelector(".session-tab-scroll")).toHaveClass("is-single");
    expect(screen.getByRole("button", { name: /Unpin .First./i })).toBeInTheDocument();
    expect(screen.getByText(/^(⌘1|Ctrl\+1)$/)).toBeInTheDocument();
    expect(screen.getByText(/^(⌘P|Ctrl\+P)$/)).toBeInTheDocument();
  });

  test("shows project suffix, ⌘N shortcuts and pin controls", () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const onTogglePin = vi.fn();
    render(
      <SessionTabBar
        tabs={tabs}
        activeTabId="t1"
        projects={projects}
        onActivate={onActivate}
        onClose={onClose}
        onTogglePin={onTogglePin}
      />,
    );

    expect(screen.getByText("alpha-app")).toBeInTheDocument();
    expect(screen.getByText("beta-app")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    // macOS → ⌘1, other platforms → Ctrl+1
    expect(screen.getByText(/^(⌘1|Ctrl\+1)$/)).toBeInTheDocument();
    expect(screen.getByText(/^(⌘2|Ctrl\+2)$/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Second"));
    expect(onActivate).toHaveBeenCalledWith("t2");

    fireEvent.click(screen.getByRole("button", { name: /Unpin .First./i }));
    expect(onTogglePin).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByRole("button", { name: /Pin .Second./i }));
    expect(onTogglePin).toHaveBeenCalledWith("t2");

    fireEvent.click(screen.getByRole("button", { name: "Close First" }));
    expect(onClose).toHaveBeenCalledWith("t1");
  });

  test("assigns unique shortcuts with the pinned tab first even when input order is mixed", () => {
    render(
      <SessionTabBar
        tabs={[tabs[1]!, tabs[0]!]}
        activeTabId="t1"
        projects={projects}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const tabRows = screen.getAllByRole("tab");
    const shortcuts = Array.from(document.querySelectorAll(".session-tab-kbd"));
    expect(tabRows[0]).toHaveClass("is-pinned");
    expect(shortcuts[0]?.textContent).toMatch(/^(⌘1|Ctrl\+1)$/);
    expect(shortcuts[1]?.textContent).toMatch(/^(⌘2|Ctrl\+2)$/);
  });

  test("opens tab actions from the context menu", () => {
    const onCloseOthers = vi.fn();
    const onCloseToRight = vi.fn();
    render(
      <SessionTabBar
        tabs={tabs}
        activeTabId="t1"
        projects={projects}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={onCloseOthers}
        onCloseToRight={onCloseToRight}
        onTogglePin={vi.fn()}
      />,
    );

    const firstTab = screen.getAllByRole("tab")[0]!;
    fireEvent.contextMenu(firstTab);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close other tabs" }));
    expect(onCloseOthers).toHaveBeenCalledWith("t1");

    fireEvent.contextMenu(firstTab);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close tabs to the right" }));
    expect(onCloseToRight).toHaveBeenCalledWith("t1");
  });
});
