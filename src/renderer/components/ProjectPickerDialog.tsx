import type { ProjectSummary } from "../../shared/protocol";
import { AppIcon } from "./icons";

export function ProjectPickerDialog({
  open,
  projects,
  onSelectProject,
  onOpenNewProject,
  onClose,
}: {
  open: boolean;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="palette-backdrop" role="dialog" aria-label="Choose project" onClick={onClose}>
      <div className="settings-dialog project-picker" onClick={(event) => event.stopPropagation()}>
        <div className="settings-heading">
          <div>
            <strong>Choose a project</strong>
            <p className="settings-subtitle">Pick an existing project or open a folder before chatting</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close project picker">
            <AppIcon name="x" size="sm" />
          </button>
        </div>

        <div className="settings-body">
          {projects.length > 0 && (
            <section className="settings-section">
              <div className="settings-section-label">Your projects</div>
              <div className="project-picker-list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="project-picker-item"
                    onClick={() => onSelectProject(project.id)}
                    title={project.path}
                  >
                    <strong>{project.name}</strong>
                    <small>{project.path}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="settings-section">
            <div className="settings-section-label">Or</div>
            <button type="button" className="project-picker-new" onClick={onOpenNewProject}>
              Open a new project…
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
