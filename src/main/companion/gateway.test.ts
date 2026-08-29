import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CompanionGateway } from "./gateway.js";

describe("companion gateway", () => {
  const gateways: CompanionGateway[] = [];

  afterEach(async () => {
    await Promise.all(gateways.splice(0).map((gateway) => gateway.stop()));
  });

  test("is off until enabled, then advertises a LAN url and token", async () => {
    const gateway = new CompanionGateway({
      userDataDir: mkdtempSync(join(tmpdir(), "pi-companion-gw-")),
      host: "127.0.0.1",
      port: 0,
      invoke: async () => undefined,
      subscribe: () => () => undefined,
      interfaces: {
        en0: [{ address: "192.168.1.23", family: "IPv4", internal: false, netmask: "", cidr: null, mac: "" }],
      },
      lookupTailscale: async () => ({}),
    });
    gateways.push(gateway);

    const idle = await gateway.getState();
    expect(idle.enabled).toBe(false);
    expect(idle.listening).toBe(false);
    expect(idle.urls).toEqual([]);

    const on = await gateway.setEnabled(true);
    expect(on.enabled).toBe(true);
    expect(on.listening).toBe(true);
    expect(on.port).toBeGreaterThan(0);
    expect(on.token.length).toBeGreaterThan(20);
    expect(on.urls.some((url) => url.origin.includes("192.168.1.23"))).toBe(true);
    expect(on.qrDataUrl?.startsWith("data:image/")).toBe(true);
  });

  test("configures a private HTTPS Serve origin when Tailscale is connected", async () => {
    const commands: string[] = [];
    let servePort: string | undefined;
    let configured = false;
    const gateway = new CompanionGateway({
      userDataDir: mkdtempSync(join(tmpdir(), "pi-companion-gw-")),
      host: "127.0.0.1",
      port: 0,
      invoke: async () => undefined,
      subscribe: () => () => undefined,
      interfaces: {
        en0: [{ address: "192.168.1.23", family: "IPv4", internal: false, netmask: "", cidr: null, mac: "" }],
      },
      lookupTailscale: async () => ({
        ip: "100.91.4.12",
        hostname: "mac.tailnet.ts.net",
        installed: true,
        connected: true,
      }),
      runTailscale: async (args) => {
        commands.push(args.join(" "));
        if (args[0] === "serve" && args[1] === "status") {
          return {
            ok: true,
            stdout: configured
              ? `{"Web":{"https://mac.tailnet.ts.net":{"/":{"Handler":"http://127.0.0.1:${servePort}"}}}}`
              : "{\"Web\":{}}",
            stderr: "",
          };
        }
        if (args[0] === "serve" && args[1] === "--bg") {
          servePort = args[3];
          configured = true;
          return { ok: true, stdout: "", stderr: "" };
        }
        if (args[0] === "serve" && args[1] === "off") {
          configured = false;
          return { ok: true, stdout: "", stderr: "" };
        }
        return { ok: true, stdout: "", stderr: "" };
      },
    });
    gateways.push(gateway);

    const state = await gateway.setEnabled(true);
    expect(commands).toContain("serve status --json");
    expect(commands.some((command) => command.startsWith("serve --bg --yes "))).toBe(true);
    expect(state.urls.some((url) => url.origin === "https://mac.tailnet.ts.net")).toBe(true);
    expect(state.tailscale).toMatchObject({ installed: true, connected: true, serving: true });
  });

  test("does not replace an existing Serve configuration", async () => {
    const commands: string[] = [];
    const gateway = new CompanionGateway({
      userDataDir: mkdtempSync(join(tmpdir(), "pi-companion-gw-")),
      host: "127.0.0.1",
      port: 0,
      invoke: async () => undefined,
      subscribe: () => () => undefined,
      interfaces: {
        en0: [{ address: "192.168.1.23", family: "IPv4", internal: false, netmask: "", cidr: null, mac: "" }],
      },
      lookupTailscale: async () => ({ installed: true, connected: true, ip: "100.91.4.12", hostname: "mac.tailnet.ts.net" }),
      runTailscale: async (args) => {
        commands.push(args.join(" "));
        if (args[0] === "serve" && args[1] === "status") {
          return {
            ok: true,
            stdout: "{\"Web\":{\"https://mac.tailnet.ts.net\":{\"/\":{\"Handler\":\"http://127.0.0.1:3000\"}}}}",
            stderr: "",
          };
        }
        return { ok: true, stdout: "", stderr: "" };
      },
    });
    gateways.push(gateway);

    const state = await gateway.setEnabled(true);
    expect(commands.some((command) => command.startsWith("serve --bg"))).toBe(false);
    expect(state.tailscale).toMatchObject({ serving: false });
    expect(state.tailscale?.error).toMatch(/another Tailscale Serve configuration/i);
  });
});
