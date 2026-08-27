import { useMemo } from "react";

export type DiffLineKind = "meta" | "hunk" | "addition" | "deletion" | "context";

export interface ParsedDiffLine {
  kind: DiffLineKind;
  oldNumber?: number;
  newNumber?: number;
  text: string;
}

export interface ChangeFileDisplay {
  name: string;
  directory: string;
  format: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const FORMAT_LABELS: Record<string, string> = {
  css: "CSS",
  htm: "HTML",
  html: "HTML",
  java: "JAVA",
  js: "JS",
  json: "JSON",
  jsx: "JSX",
  md: "MD",
  mjs: "JS",
  py: "PY",
  scss: "SCSS",
  sh: "SH",
  sql: "SQL",
  ts: "TS",
  tsx: "TSX",
  vue: "VUE",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

export function formatChangeFile(path: string, root?: string): ChangeFileDisplay {
  const normalized = path.replaceAll("\\", "/");
  const normalizedRoot = root?.replaceAll("\\", "/").replace(/\/$/, "");
  const relativePath = normalizedRoot && (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`))
    ? normalized.slice(normalizedRoot.length).replace(/^\//, "")
    : normalized;
  const parts = relativePath.split("/");
  const name = parts.at(-1) || path;
  const extension = name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  return {
    name,
    directory: parts.slice(0, -1).join("/"),
    format: extension ? FORMAT_LABELS[extension] ?? extension.toUpperCase() : "FILE",
  };
}

/** Parse a unified patch into renderable lines while tracking both file sides. */
export function parseDiffLines(diff: string): ParsedDiffLine[] {
  let oldNumber = 0;
  let newNumber = 0;
  let inHunk = false;
  const rawLines = diff.split(/\r?\n/);
  if (rawLines.at(-1) === "") rawLines.pop();

  return rawLines.map((rawLine) => {
    const line = rawLine;
    const hunk = line.match(HUNK_HEADER);
    if (hunk) {
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      inHunk = true;
      return { kind: "hunk", text: line };
    }

    // File headers and the "no newline" marker are metadata, not source
    // lines. Only treat them as headers before the first hunk so a deleted
    // line whose content starts with "++" remains a deletion.
    if (!inHunk || line.startsWith("\\ No newline at end of file")) {
      return { kind: "meta", text: line };
    }

    if (line.startsWith("+")) {
      const current = newNumber;
      newNumber += 1;
      return { kind: "addition", newNumber: current, text: line.slice(1) };
    }

    if (line.startsWith("-")) {
      const current = oldNumber;
      oldNumber += 1;
      return { kind: "deletion", oldNumber: current, text: line.slice(1) };
    }

    const currentOld = oldNumber;
    const currentNew = newNumber;
    oldNumber += 1;
    newNumber += 1;
    return {
      kind: "context",
      oldNumber: currentOld,
      newNumber: currentNew,
      text: line.startsWith(" ") ? line.slice(1) : line,
    };
  });
}

export function formatHunkLabel(hunk: string): string {
  const match = hunk.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return "Changed lines";
  const newStart = Number(match[2]);
  const newCount = Number(match[3] ?? 1);
  const newEnd = newStart + newCount - 1;
  return newStart === newEnd ? `Line ${newStart}` : `Lines ${newStart}–${newEnd}`;
}

interface CompanionDiffPreviewProps {
  diff: string;
  path: string;
}

export function CompanionDiffPreview({ diff, path }: CompanionDiffPreviewProps) {
  const lines = useMemo(
    () => parseDiffLines(diff).filter((line) => line.kind !== "meta"),
    [diff],
  );

  return (
    <div className="companion-diff" aria-label={`Diff for ${path}`}>
      {lines.map((line, index) => (
        <div
          key={`${line.kind}-${index}`}
          className={`companion-diff-line is-${line.kind}`}
          data-line-kind={line.kind}
        >
          <span className="companion-diff-number" aria-hidden="true">
            {line.newNumber ?? line.oldNumber ?? ""}
          </span>
          <span className="companion-diff-marker" aria-hidden="true">
            {line.kind === "addition" ? "+" : line.kind === "deletion" ? "−" : line.kind === "hunk" ? "·" : " "}
          </span>
          <code className="companion-diff-text">
            {line.kind === "hunk" ? formatHunkLabel(line.text) : line.text || " "}
          </code>
        </div>
      ))}
    </div>
  );
}
