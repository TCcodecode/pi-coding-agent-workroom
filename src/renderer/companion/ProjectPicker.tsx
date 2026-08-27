import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionSummary } from "../../shared/protocol";
import type { ProjectSummary } from "../../shared/workspace";

export interface ProjectPickerButtonProps {
  project?: ProjectSummary;
  branchName?: string;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}

export interface ProjectPickerDialogProps {
  projects: ProjectSummary[];
  activeProjectId?: string;
  open: boolean;
  externalPendingProjectId?: string;
  onClose: () => void;
  onLoadSessions: (project: ProjectSummary) => Promise<SessionSummary[]>;
  onNewSession: (project: ProjectSummary) => Promise<void>;
  onOpenSession: (project: ProjectSummary, session: SessionSummary) => Promise<void>;
}

function projectPath(path: string): string {
  const compact = path.replace(/^\/Users\/[^/]+/, "~");
  return compact.length > 52 ? `…${compact.slice(-49)}` : compact;
}

export function ProjectPickerButton({
  project,
  branchName,
  disabled = false,
  compact = false,
  onClick,
}: ProjectPickerButtonProps) {
  return (
    <button
      type="button"
      className={`companion-project-picker-button${compact ? " is-compact" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={project ? `Change project, currently ${project.name}` : "Choose a project"}
      aria-haspopup="dialog"
    >
      <span className="companion-project-picker-copy">
        <span className="companion-project-picker-label">Project</span>
        <span className="companion-project-picker-name">
          <strong>{project?.name ?? "Choose a project"}</strong>
          {branchName && <span className="companion-project-picker-branch">· {branchName}</span>}
        </span>
      </span>
      <span className="companion-project-picker-chevron" aria-hidden="true">⌄</span>
    </button>
  );
}

export function ProjectPickerDialog({
  projects,
  activeProjectId,
  open,
  externalPendingProjectId,
  onClose,
  onLoadSessions,
  onNewSession,
  onOpenSession,
}: ProjectPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [pendingProjectId, setPendingProjectId] = useState<string>();
  const [selectedProject, setSelectedProject] = useState<ProjectSummary>();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string>();
  const searchRef = useRef<HTMLInputElement>(null);
  const isBusy = Boolean(pendingProjectId || externalPendingProjectId || actionPending);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedProject(undefined);
    setSessions([]);
    setError(undefined);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose, open]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.path}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [projects, query]);

  if (!open) return null;

  const chooseProject = async (project: ProjectSummary) => {
    if (isBusy) return;
    setPendingProjectId(project.id);
    setError(undefined);
    try {
      const nextSessions = await onLoadSessions(project);
      setSessions(nextSessions);
      setSelectedProject(project);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    } finally {
      setPendingProjectId(undefined);
    }
  };

  const runSessionAction = async (action: () => Promise<void>) => {
    if (isBusy) return;
    setActionPending(true);
    setError(undefined);
    try {
      await action();
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div
      className="companion-project-picker-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <section
        className="companion-project-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-project-picker-title"
      >
        <div className="companion-project-picker-grabber" aria-hidden="true" />
        <header className="companion-project-picker-header">
          {selectedProject && (
            <button
              type="button"
              className="companion-project-picker-back"
              onClick={() => {
                setSelectedProject(undefined);
                setSessions([]);
                setError(undefined);
              }}
              disabled={isBusy}
              aria-label="Back to projects"
            >
              ‹
            </button>
          )}
          <div>
            <p className="companion-eyebrow">{selectedProject ? selectedProject.name : "Workspace"}</p>
            <h2 id="companion-project-picker-title">{selectedProject ? "Choose a session" : "Choose a project"}</h2>
          </div>
          <button
            type="button"
            className="companion-icon-button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close project picker"
          >
            ×
          </button>
        </header>

        {!selectedProject && (
          <label className="companion-project-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              disabled={isBusy}
            />
          </label>
        )}

        {error && <p className="companion-project-picker-error" role="alert">{error}</p>}

        {!selectedProject ? (
          <div className="companion-project-picker-list" role="listbox" aria-label="Projects">
            {filteredProjects.length === 0 && (
              <p className="companion-empty">No projects match “{query}”.</p>
            )}
            {filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isPending = project.id === pendingProjectId || project.id === externalPendingProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`companion-project-picker-option${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => void chooseProject(project)}
                  disabled={isBusy}
                >
                  <span className="companion-project-picker-mark" aria-hidden="true">
                    {isPending ? <span className="companion-spinner" /> : isActive ? "✓" : ""}
                  </span>
                  <span className="companion-project-picker-option-copy">
                    <strong>{project.name}</strong>
                    <span>{projectPath(project.path)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="companion-project-session-step">
            <button
              type="button"
              className="companion-project-new-session"
              onClick={() => void runSessionAction(() => onNewSession(selectedProject))}
              disabled={isBusy}
            >
              <span aria-hidden="true">＋</span>
              <span><strong>New session</strong><small>Start with a clean context</small></span>
            </button>
            <div className="companion-project-session-list" role="listbox" aria-label={`${selectedProject.name} sessions`}>
              {sessions.length === 0 && <p className="companion-empty">No previous sessions.</p>}
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className="companion-project-session-option"
                  role="option"
                  aria-selected={session.sessionId === undefined ? undefined : false}
                  onClick={() => void runSessionAction(() => onOpenSession(selectedProject, session))}
                  disabled={isBusy || !session.sessionFile}
                >
                  <span aria-hidden="true">◷</span>
                  <span><strong>{session.name || "Untitled session"}</strong><small>{session.messageCount ? `${session.messageCount} messages` : "Previous session"}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
