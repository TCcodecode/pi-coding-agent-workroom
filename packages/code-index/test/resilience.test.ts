import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFile } from "../src/parser.js";
import { createCodeIndex } from "../src/index.js";

describe("index resilience", () => {
  it("skips a file whose grammar parse traps the WASM VM", async () => {
    const parserModule = await import("web-tree-sitter");
    const realParse = parserModule.Parser.prototype.parse;
    // Simulate the tree-sitter "memory access out of bounds" WASM trap.
    parserModule.Parser.prototype.parse = vi.fn(() => {
      throw new Error("memory access out of bounds");
    });
    try {
      const parsed = await parseFile("/tmp/x.ts", "export function a() {}");
      expect(parsed).toEqual({ symbols: [], imports: [] });
    } finally {
      parserModule.Parser.prototype.parse = realParse;
    }
  });

  it("completes the whole index when one file crashes parsing", async () => {
    const parserModule = await import("web-tree-sitter");
    const realParse = parserModule.Parser.prototype.parse;
    let calls = 0;
    parserModule.Parser.prototype.parse = vi.fn(function (this: unknown, ...args: unknown[]) {
      calls++;
      if (calls === 1) throw new Error("memory access out of bounds");
      return realParse.apply(this, args as [string]);
    });
    const projectRoot = await mkdtemp(join(tmpdir(), "code-index-resilience-"));
    try {
      await writeFile(join(projectRoot, "alpha.ts"), "export function alpha() {}\n");
      await writeFile(join(projectRoot, "beta.ts"), "export function beta() {}\n");

      const idx = createCodeIndex({ dbPath: ":memory:" });
      try {
        const stats = await idx.index(projectRoot);
        expect(stats.filesIndexed).toBeGreaterThan(0);
        expect(stats.filesChanged).toBeGreaterThan(0);
      } finally {
        idx.dispose();
      }
    } finally {
      parserModule.Parser.prototype.parse = realParse;
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
