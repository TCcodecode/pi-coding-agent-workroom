import { describe, expect, test } from "vitest";
import { formatChangeFile, formatHunkLabel, parseDiffLines } from "./DiffPreview";

describe("companion diff preview", () => {
  test("tracks old and new line numbers across a unified patch", () => {
    const lines = parseDiffLines([
      "--- src/App.tsx",
      "+++ src/App.tsx",
      "@@ -1,3 +1,4 @@",
      " context",
      "-old line",
      "+new line",
      "+another new line",
      " tail",
      "",
    ].join("\n"));

    expect(lines.map(({ kind, oldNumber, newNumber, text }) => ({ kind, oldNumber, newNumber, text }))).toEqual([
      { kind: "meta", oldNumber: undefined, newNumber: undefined, text: "--- src/App.tsx" },
      { kind: "meta", oldNumber: undefined, newNumber: undefined, text: "+++ src/App.tsx" },
      { kind: "hunk", oldNumber: undefined, newNumber: undefined, text: "@@ -1,3 +1,4 @@" },
      { kind: "context", oldNumber: 1, newNumber: 1, text: "context" },
      { kind: "deletion", oldNumber: 2, newNumber: undefined, text: "old line" },
      { kind: "addition", oldNumber: undefined, newNumber: 2, text: "new line" },
      { kind: "addition", oldNumber: undefined, newNumber: 3, text: "another new line" },
      { kind: "context", oldNumber: 3, newNumber: 4, text: "tail" },
    ]);
  });

  test("does not render a phantom row for the patch's trailing newline", () => {
    expect(parseDiffLines("@@ -1 +1 @@\n-old\n+new\n")).toHaveLength(3);
  });

  test("turns hunk metadata into a compact line-range label", () => {
    expect(formatHunkLabel("@@ -469,4 +469,39 @@")).toBe("Lines 469–507");
    expect(formatHunkLabel("@@ -8 +8 @@")).toBe("Line 8");
  });

  test("formats absolute paths as a file name, directory, and file type", () => {
    expect(formatChangeFile("/Users/tc/work/pi-workspace/src/styles.css", "/Users/tc/work/pi-workspace")).toEqual({
      name: "styles.css",
      directory: "src",
      format: "CSS",
    });
    expect(formatChangeFile("src/components/Button.tsx").format).toBe("TSX");
  });
});
