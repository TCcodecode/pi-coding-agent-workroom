import { useEffect, useState } from "react";
import type { SessionTreeNode } from "../../shared/protocol";
import { SessionTree } from "./SessionTree";
import { AppIcon } from "./icons";

export interface TreeDialogProps {
  open: boolean;
  loadTree: () => Promise<SessionTreeNode[]>;
  onFork: (entryId: string) => void;
  onClose: () => void;
}

export function TreeDialog({ open, loadTree, onFork, onClose }: TreeDialogProps) {
  const [nodes, setNodes] = useState<SessionTreeNode[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(undefined);
    void loadTree().then((tree) => {
      if (active) setNodes(tree);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [open, loadTree]);

  if (!open) return null;
  return (
    <div className="palette-backdrop" role="dialog" aria-label="Session tree" onClick={onClose}>
      <div className="tree-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="settings-heading">
          <strong>Session tree</strong>
          <button type="button" onClick={onClose} aria-label="Close session tree"><AppIcon name="x" size="sm" /></button>
        </div>
        {error && <div className="tree-error">{error}</div>}
        {!error && nodes.length === 0 && <div className="tree-empty">No session tree available — start a session first.</div>}
        {!error && nodes.length > 0 && <div className="tree-scroll"><SessionTree nodes={nodes} onSelect={(id) => onFork(id)} /></div>}
        <p className="tree-hint">Select a node to fork a new session from that point.</p>
      </div>
    </div>
  );
}
