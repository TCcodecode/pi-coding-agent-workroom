import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { SessionSummary } from "../../shared/protocol";
import type { ProjectSummary } from "../../shared/workspace";
import { ProjectPickerButton, ProjectPickerDialog } from "./ProjectPicker";

const projects: ProjectSummary[] = [
  { id: "cowinx", name: "Cowinx", path: "/Users/test/work/cowinx", updatedAt: "2026-08-22" },
  { id: "pi", name: "Pi Workroom", path: "/Users/test/work/pi-workspace", updatedAt: "2026-08-21" },
];

const previousSession: SessionSummary = {
  sessionId: "session-1",
  sessionFile: "/Users/test/.pi/session-1.jsonl",
  cwd: projects[1].path,
  name: "Previous work",
  status: "idle",
  model: "deepseek-v4-flash",
  thinkingLevel: "medium",
  messageCount: 12,
  updatedAt: "2026-08-23T08:00:00.000Z",
};

describe("ProjectPickerDialog", () => {
  test("shows the current branch after the project name", () => {
    render(<ProjectPickerButton project={projects[0]} branchName="feature/mobile" onClick={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("Cowinx");
    expect(screen.getByRole("button")).toHaveTextContent("feature/mobile");
  });

  test("filters projects and keeps the active project accessible", () => {
    render(
      <ProjectPickerDialog
        projects={projects}
        activeProjectId="cowinx"
        open
        onClose={vi.fn()}
        onLoadSessions={vi.fn(async () => [])}
        onNewSession={vi.fn(async () => undefined)}
        onOpenSession={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("option", { name: /Cowinx/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "workroom" } });

    expect(screen.queryByRole("option", { name: /Cowinx/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Pi Workroom/ })).toBeInTheDocument();
  });

  test("opens the selected project's new and previous session choices", async () => {
    const onClose = vi.fn();
    const onLoadSessions = vi.fn(async () => [previousSession]);
    const onOpenSession = vi.fn(async () => undefined);
    render(
      <ProjectPickerDialog
        projects={projects}
        activeProjectId="cowinx"
        open
        onClose={onClose}
        onLoadSessions={onLoadSessions}
        onNewSession={vi.fn(async () => undefined)}
        onOpenSession={onOpenSession}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /Pi Workroom/ }));
    await waitFor(() => expect(onLoadSessions).toHaveBeenCalledWith(projects[1]));
    expect(screen.getByRole("heading", { name: "Choose a session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New session/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Previous work/ }));

    await waitFor(() => expect(onOpenSession).toHaveBeenCalledWith(projects[1], previousSession));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("creates a new session only after explicit confirmation", async () => {
    const onNewSession = vi.fn(async () => undefined);
    render(
      <ProjectPickerDialog
        projects={projects}
        activeProjectId="cowinx"
        open
        onClose={vi.fn()}
        onLoadSessions={vi.fn(async () => [])}
        onNewSession={onNewSession}
        onOpenSession={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /Pi Workroom/ }));
    await screen.findByRole("heading", { name: "Choose a session" });
    expect(onNewSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /New session/ }));
    await waitFor(() => expect(onNewSession).toHaveBeenCalledWith(projects[1]));
  });
});
