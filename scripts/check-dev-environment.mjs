/* global console, process */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const minimumNode = [22, 12, 0];
const nodeVersion = process.versions.node.split(".").map(Number);
const problems = [];

if (compareVersions(nodeVersion, minimumNode) < 0) {
  problems.push(
    `Node.js ${minimumNode.join(".")} or newer is required (current: ${process.versions.node}).`,
  );
}

let electronDirectory;
let electronVersion;

try {
  const electronPackagePath = require.resolve("electron/package.json");
  electronDirectory = dirname(electronPackagePath);
  electronVersion = JSON.parse(readFileSync(electronPackagePath, "utf8")).version;
} catch {
  problems.push("Electron is not installed. Development dependencies may have been omitted.");
}

if (electronDirectory) {
  const binaryPath = getElectronBinaryPath(electronDirectory, process.platform);

  if (!binaryPath || !existsSync(binaryPath)) {
    problems.push(
      "The Electron desktop binary is missing. Its install script did not finish downloading the platform binary.",
    );
  }
}

if (problems.length > 0) {
  console.error("\nPI Desk development environment check failed:\n");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  console.error(`\nRun these commands from the repository root:\n`);
  console.error("  npm install --include=dev");
  console.error("  npm rebuild electron");
  console.error("  npm run dev\n");
  console.error("Do not use --omit=dev, --production, or --ignore-scripts for development installs.");
  process.exit(1);
}

console.log(`Electron ${electronVersion} desktop binary is ready.`);

function compareVersions(left, right) {
  for (let index = 0; index < right.length; index += 1) {
    const difference = (left[index] ?? 0) - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function getElectronBinaryPath(electronDirectory, platform) {
  const platformBinaryPath = {
    darwin: ["dist", "Electron.app", "Contents", "MacOS", "Electron"],
    linux: ["dist", "electron"],
    win32: ["dist", "electron.exe"],
  }[platform];

  return platformBinaryPath ? join(electronDirectory, ...platformBinaryPath) : null;
}
