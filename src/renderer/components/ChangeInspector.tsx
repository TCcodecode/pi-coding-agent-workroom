import { useEffect, useMemo, useState } from "react";
import type { FileChangeSummary } from "../../shared/protocol";
import { AppIcon } from "./icons";

interface ChangeInspectorProps {
  changes: FileChangeSummary[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  onOpenFile: (path: string) => void;
  onUndo?: (path: string) => void;
  onOpenInspector: () => void;
  onClose?: () => void;
}

interface FileTreeNode {
  name: string;
  path: string;
  change?: FileChangeSummary;
  children: FileTreeNode[];
}

interface MutableFileTreeNode extends Omit<FileTreeNode, "children"> {
  children: Map<string, MutableFileTreeNode>;
}

function buildFileTree(changes: FileChangeSummary[]): FileTreeNode[] {
  const root = new Map<string, MutableFileTreeNode>();
  for (const change of changes) {
    const parts = change.path.split(/[\\/]/).filter(Boolean);
    let level = root;
    let path = "";
    parts.forEach((part, index) => {
      path = path ? `${path}/${part}` : part;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path, children: new Map() };
        level.set(part, node);
      }
      if (index === parts.length - 1) node.change = change;
      level = node.children;
    });
  }

  const materialize = (nodes: Map<string, MutableFileTreeNode>): FileTreeNode[] =>
    [...nodes.values()]
      .sort((a, b) => {
        const aFile = a.change ? 1 : 0;
        const bFile = b.change ? 1 : 0;
        return aFile - bFile || a.name.localeCompare(b.name);
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        change: node.change,
        children: materialize(node.children),
      }));

  return materialize(root);
}

function FileTreeNodeView({
  node,
  level,
  selectedPath,
  onSelect,
  onOpenFile,
  reviewedPaths,
}: {
  node: FileTreeNode;
  level: number;
  selectedPath?: string;
  onSelect: (path: string) => void;
  onOpenFile: (path: string) => void;
  reviewedPaths: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(true);
  if (node.change) {
    return (
      <button
        type="button"
        className={`change-tree-file ${selectedPath === node.change.path ? "selected" : ""} ${reviewedPaths.has(node.change.path) ? "reviewed" : ""}`}
        style={{ paddingLeft: `${10 + level * 14}px` }}
        aria-label={`Open change ${node.change.path}`}
        aria-pressed={selectedPath === node.change.path}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onOpenFile(node.change!.path);
          } else {
            onSelect(node.change!.path);
          }
        }}
      >
        <AppIcon name={reviewedPaths.has(node.change.path) ? "check" : "fileCode2"} size="xs" />
        <span className="change-tree-name">{node.name}</span>
        <span className="change-tree-stats">
          <span className="change-additions">+{node.change.additions}</span>
          <span className="change-deletions">-{node.change.deletions}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="change-tree-folder">
      <button
        type="button"
        className="change-tree-folder-button"
        style={{ paddingLeft: `${8 + level * 14}px` }}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} folder ${node.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="chevronRight" size="xs" className={`change-tree-chevron ${open ? "open" : ""}`} />
        <AppIcon name="folder" size="xs" />
        <span className="change-tree-name">{node.name}</span>
      </button>
      {open && node.children.map((child) => (
        <FileTreeNodeView
          key={child.path}
          node={child}
          level={level + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onOpenFile={onOpenFile}
          reviewedPaths={reviewedPaths}
        />
      ))}
    </div>
  );
}

function DiffView({ change, showTitle = true }: { change: FileChangeSummary; showTitle?: boolean }) {
  return (
    <div className="change-diff-file">
      {showTitle && <div className="change-diff-file-title">{change.path}</div>}
      <div className="change-diff-code" role="code" aria-label={`Diff for ${change.path}`}>
        {change.diff.split("\n").map((line, index) => {
          const added = line.startsWith("+") && !line.startsWith("+++");
          const removed = line.startsWith("-") && !line.startsWith("---");
          return (
            <div className={`change-diff-line ${added ? "added" : removed ? "removed" : ""}`} key={`${change.path}-${index}`}>
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChangeInspector({ changes, selectedPath, onSelect, onOpenFile, onUndo, onOpenInspector, onClose }: ChangeInspectorProps) {
  const tree = useMemo(() => buildFileTree(changes), [changes]);
  const selectedChange = changes.find((change) => change.path === selectedPath) ?? changes[0];
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(() => new Set());
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const paths = new Set(changes.map((change) => change.path));
    setReviewedPaths((current) => new Set([...current].filter((path) => paths.has(path))));
    setCollapsedPaths((current) => new Set([...current].filter((path) => paths.has(path))));
  }, [changes]);

  const selectedIsReviewed = selectedChange ? reviewedPaths.has(selectedChange.path) : false;
  const selectedIsCollapsed = selectedChange
    ? selectedIsReviewed || collapsedPaths.has(selectedChange.path)
    : false;
  const toggleReviewed = (path: string, reviewed: boolean) => {
    setReviewedPaths((current) => {
      const next = new Set(current);
      if (reviewed) next.add(path);
      else next.delete(path);
      return next;
    });
    if (!reviewed) {
      setCollapsedPaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  };
  const toggleCollapsed = (path: string) => {
    if (reviewedPaths.has(path)) {
      toggleReviewed(path, false);
      return;
    }
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const handleFileSelect = (path: string) => {
    if (selectedChange?.path === path) toggleCollapsed(path);
    else onSelect(path);
  };

  return (
    <aside className="inspector changes-inspector" aria-label="Session changes">
      <div className="inspector-header">
        <div className="right-pane-mode-tabs" role="tablist" aria-label="Right panel mode">
          <button type="button" role="tab" aria-selected="false" onClick={onOpenInspector}>Inspector</button>
          <button type="button" role="tab" aria-selected="true" className="selected">
            Changes{changes.length > 0 && <span className="tab-badge">{changes.length}</span>}
          </button>
        </div>
        {onClose && (
          <div className="inspector-header-actions">
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close changes" title="Close changes">
              <AppIcon name="x" size="sm" />
            </button>
          </div>
        )}
      </div>

      <div className="changes-inspector-content">
        <div className="change-inspector-section">
          <div className="change-inspector-section-heading">
            <span>THIS SESSION</span>
            {changes.length > 0 && <span className="section-count">{changes.length}</span>}
          </div>
          {tree.length > 0 ? (
            <div className="change-tree" aria-label="Changed files">
              {tree.map((node) => (
                <FileTreeNodeView
                  key={node.path}
                  node={node}
                  level={0}
                  selectedPath={selectedChange?.path}
                  onSelect={handleFileSelect}
                  onOpenFile={onOpenFile}
                  reviewedPaths={reviewedPaths}
                />
              ))}
            </div>
          ) : (
            <div className="change-inspector-empty">No file changes in this session.</div>
          )}
        </div>

        {selectedChange && (
          <div className="change-inspector-diff">
            <div className="change-inspector-section-heading change-inspector-diff-heading">
              <button
                type="button"
                className="change-selected-file-title"
                aria-expanded={!selectedIsCollapsed}
                aria-label={`Toggle diff for ${selectedChange.path}`}
                title="Click to collapse or show this diff"
                onClick={() => toggleCollapsed(selectedChange.path)}
              >
                <AppIcon name="fileCode2" size="xs" />
                <span>{selectedChange.path}</span>
              </button>
              <div className="change-inspector-diff-actions">
                <label className="change-reviewed-toggle">
                  <input
                    type="checkbox"
                    checked={selectedIsReviewed}
                    aria-label={`Mark ${selectedChange.path} as reviewed`}
                    onChange={(event) => toggleReviewed(selectedChange.path, event.target.checked)}
                  />
                  <span>Reviewed</span>
                </label>
                <button
                  type="button"
                  className="change-collapse-button"
                  aria-label={`${selectedIsCollapsed ? "Show" : "Collapse"} diff for ${selectedChange.path}`}
                  onClick={() => toggleCollapsed(selectedChange.path)}
                >
                  {selectedIsCollapsed ? "Show diff" : "Collapse"}
                </button>
                {onUndo && (
                  <button
                    type="button"
                    className="change-undo-button"
                    aria-label={`Undo changes to ${selectedChange.path}`}
                    onClick={() => onUndo(selectedChange.path)}
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
            {!selectedIsCollapsed && <DiffView change={selectedChange} showTitle={false} />}
          </div>
        )}
      </div>
    </aside>
  );
}
