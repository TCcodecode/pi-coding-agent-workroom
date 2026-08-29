import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import QRCode from "qrcode";
import { COMPANION_PORT, type CompanionState } from "../../shared/companion.js";
import { mintCompanionToken } from "./pairing.js";
import { CompanionServer } from "./server.js";
import { companionOrigins, pageUrl } from "./urls.js";

const execFileAsync = promisify(execFile);

interface TailscaleCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

type RunTailscale = (args: string[], timeoutMs?: number) => Promise<TailscaleCommandResult>;

interface TailscaleLookup {
  ip?: string;
  hostname?: string;
  installed?: boolean;
  connected?: boolean;
  error?: string;
}

interface CompanionFileStore {
  enabled: boolean;
  token: string;
  serveManaged: boolean;
}

async function runTailscaleCommand(args: string[], timeoutMs = 1500): Promise<TailscaleCommandResult> {
  try {
    const result = await execFileAsync("tailscale", args, { timeout: timeoutMs, maxBuffer: 1_000_000 });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: cause.stdout ?? "",
      stderr: cause.stderr ?? "",
      error: cause.code === "ENOENT" ? "not installed" : cause.message || "Tailscale command failed",
    };
  }
}

function commandOutput(result: TailscaleCommandResult): string {
  return `${result.stderr}\n${result.stdout}`.trim();
}

function hasServeRoutes(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return [parsed.Web, parsed.TCP].some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
    });
  } catch {
    return /(?:https?:|tcp:).*127\.0\.0\.1:\d+/i.test(raw);
  }
}

function servesPort(raw: string, port: number): boolean {
  return new RegExp(`(?:^|[^0-9])${port}(?:[^0-9]|$)`).test(raw);
}

function hasOnlyDedicatedLocalTarget(raw: string, port: number): boolean {
  const matches = [...raw.matchAll(/(?:127\.0\.0\.1|localhost):(\d+)/g)].map((match) => Number(match[1]));
  return matches.length === 1 && matches[0] === port;
}

function serveOrigin(hostname: string | undefined, raw: string): string | undefined {
  const fromStatus = raw.match(/https:\/\/[^\s"\\]+/i)?.[0]?.replace(/[),]+$/, "");
  return fromStatus ?? (hostname ? `https://${hostname}` : undefined);
}

export async function lookupTailscale(run: RunTailscale = runTailscaleCommand): Promise<TailscaleLookup> {
  const ipResult = await run(["ip", "-4"]);
  if (!ipResult.ok) {
    return {
      installed: ipResult.error !== "not installed",
      connected: false,
      error: ipResult.error,
    };
  }

  const ip = ipResult.stdout.trim().split(/\s+/)[0] || undefined;
  let hostname: string | undefined;
  const statusResult = await run(["status", "--json"]);
  if (statusResult.ok) {
    try {
      const parsed = JSON.parse(statusResult.stdout) as { Self?: { DNSName?: string } };
      hostname = parsed.Self?.DNSName?.replace(/\.$/, "") || undefined;
    } catch {
      hostname = undefined;
    }
  }
  return { ip, hostname, installed: true, connected: Boolean(ip), error: ip ? undefined : commandOutput(statusResult) };
}

export class CompanionGateway {
  private store: CompanionFileStore;
  private server: CompanionServer | undefined;
  private lastError: string | undefined;
  private lastTailscaleError: string | undefined;

  constructor(
    private readonly options: {
      userDataDir: string;
      host?: string;
      port?: number;
      invoke: (method: string, args: unknown[]) => Promise<unknown>;
      subscribe: (listener: (event: unknown) => void) => () => void;
      staticRoot?: string;
      devProxyOrigin?: string;
      /** Resolve the current workspace cwd for preview port inference. */
      previewCwd?: () => string | undefined;
      interfaces?: NodeJS.Dict<NetworkInterfaceInfo[]>;
      lookupTailscale?: () => Promise<TailscaleLookup>;
      runTailscale?: RunTailscale;
    },
  ) {
    this.store = this.readStore();
  }

  async restore(): Promise<void> {
    if (this.store.enabled) await this.startServer();
  }

  async getState(): Promise<CompanionState> {
    return this.buildState();
  }

  async setEnabled(enabled: boolean): Promise<CompanionState> {
    if (enabled) {
      if (!this.store.token) this.store.token = mintCompanionToken();
      this.store.enabled = true;
      this.writeStore();
      await this.startServer();
    } else {
      this.store.enabled = false;
      this.writeStore();
      await this.stop();
    }
    return this.buildState();
  }

  async rotateToken(): Promise<CompanionState> {
    this.store.token = mintCompanionToken();
    this.writeStore();
    this.server?.setToken(this.store.token);
    return this.buildState();
  }

  async stop(): Promise<void> {
    await this.stopTailscaleServe();
    if (!this.server) return;
    await this.server.close();
    this.server = undefined;
  }

  private storePath(): string {
    return join(this.options.userDataDir, "companion.json");
  }

  private readStore(): CompanionFileStore {
    try {
      if (!existsSync(this.storePath())) return { enabled: false, token: mintCompanionToken(), serveManaged: false };
      const raw = JSON.parse(readFileSync(this.storePath(), "utf8")) as Partial<CompanionFileStore>;
      return {
        enabled: raw.enabled === true,
        token: typeof raw.token === "string" && raw.token.length > 8 ? raw.token : mintCompanionToken(),
        serveManaged: raw.serveManaged === true,
      };
    } catch {
      return { enabled: false, token: mintCompanionToken(), serveManaged: false };
    }
  }

  private writeStore(): void {
    mkdirSync(dirname(this.storePath()), { recursive: true });
    writeFileSync(this.storePath(), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  private runner(): RunTailscale {
    return this.options.runTailscale ?? runTailscaleCommand;
  }

  private port(): number {
    return this.server?.port ?? this.options.port ?? COMPANION_PORT;
  }

  private async readServeStatus(): Promise<{ available: boolean; configured: boolean; raw: string; error?: string }> {
    const result = await this.runner()(["serve", "status", "--json"]);
    const raw = commandOutput(result);
    if (result.ok) return { available: true, configured: hasServeRoutes(result.stdout), raw: result.stdout };
    if (result.error === "not installed") return { available: false, configured: false, raw, error: "Tailscale is not installed." };
    if (/no serve|not serving|no config/i.test(raw)) return { available: true, configured: false, raw };
    return { available: true, configured: false, raw, error: result.error ?? "Unable to read Tailscale Serve status." };
  }

  private async ensureTailscaleServe(): Promise<void> {
    this.lastTailscaleError = undefined;
    const lookup = await (this.options.lookupTailscale ?? (() => lookupTailscale(this.runner())))();
    if (!lookup.connected) return;

    const port = this.port();
    const status = await this.readServeStatus();
    if (status.error) {
      this.lastTailscaleError = status.error;
      return;
    }
    if (status.configured) {
      if (!servesPort(status.raw, port)) {
        this.lastTailscaleError = "Another Tailscale Serve configuration is active; Companion left it unchanged.";
      }
      return;
    }

    const result = await this.runner()(["serve", "--bg", "--yes", String(port)], 5000);
    if (!result.ok) {
      this.lastTailscaleError = commandOutput(result) || result.error || "Unable to start Tailscale Serve.";
      return;
    }
    this.store.serveManaged = true;
    this.writeStore();
  }

  private async stopTailscaleServe(): Promise<void> {
    if (!this.store.serveManaged) return;
    const status = await this.readServeStatus();
    const port = this.port();
    if (!status.configured) {
      if (!status.error) {
        this.store.serveManaged = false;
        this.writeStore();
      }
      return;
    }
    if (!servesPort(status.raw, port) || !hasOnlyDedicatedLocalTarget(status.raw, port)) return;
    const result = await this.runner()(["serve", "off"], 5000);
    if (result.ok) {
      this.store.serveManaged = false;
      this.writeStore();
    }
  }

  private async buildState(): Promise<CompanionState> {
    const listening = Boolean(this.server);
    const port = this.port();
    if (!listening) {
      return {
        enabled: false,
        listening: false,
        port,
        token: this.store.token,
        urls: [],
      };
    }

    const lookup = await (this.options.lookupTailscale ?? (() => lookupTailscale(this.runner())))();
    const serveStatus = lookup.connected ? await this.readServeStatus() : undefined;
    const serving = Boolean(serveStatus?.configured && servesPort(serveStatus.raw, port));
    const origin = serving ? serveOrigin(lookup.hostname, serveStatus?.raw ?? "") : undefined;
    const tailscaleError = this.lastTailscaleError
      ?? (!lookup.installed
        ? "Tailscale is not installed. LAN access is still available."
        : !lookup.connected
          ? "Tailscale is not connected. Sign in on this Mac to enable private remote access."
          : serveStatus?.error
            ?? (serveStatus?.configured && !serving
              ? "Another Tailscale Serve configuration is active; Companion left it unchanged."
              : undefined));
    const urls = companionOrigins({
      port,
      interfaces: this.options.interfaces ?? networkInterfaces(),
      tailscaleIPv4: lookup.ip,
      tailscaleHostname: lookup.hostname,
      tailscaleServeOrigin: origin,
    });
    const pairUrl = urls.find((url) => url.origin.startsWith("https://")) ?? urls[0];
    let qrDataUrl: string | undefined;
    if (pairUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(pageUrl(pairUrl.origin, this.store.token), {
          width: 280,
          margin: 1,
          color: { dark: "#202020", light: "#ffffff" },
        });
      } catch {
        qrDataUrl = undefined;
      }
    }
    return {
      enabled: this.store.enabled && listening,
      listening,
      port,
      token: this.store.token,
      urls,
      tailscale: {
        installed: lookup.installed === true,
        connected: lookup.connected === true,
        serving,
        origin,
        error: tailscaleError,
      },
      qrDataUrl,
      error: this.lastError,
    };
  }

  private async startServer(): Promise<void> {
    if (this.server) return;
    this.lastError = undefined;
    const server = new CompanionServer({
      host: this.options.host ?? "0.0.0.0",
      port: this.options.port ?? COMPANION_PORT,
      token: this.store.token,
      staticRoot: this.options.staticRoot,
      devProxyOrigin: this.options.devProxyOrigin,
      previewCwd: this.options.previewCwd,
      invoke: this.options.invoke,
      subscribe: this.options.subscribe,
    });
    try {
      await server.listen();
      this.server = server;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.store.enabled = false;
      this.writeStore();
      return;
    }
    try {
      await this.ensureTailscaleServe();
    } catch (error) {
      this.lastTailscaleError = error instanceof Error ? error.message : String(error);
    }
  }
}
