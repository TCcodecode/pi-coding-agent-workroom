import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  McpConfigView,
  McpStatusSnapshotView,
  ModelOption,
  ProviderAuthStatus,
  ProviderLoginEvent,
  ProviderLoginPrompt,
  ThinkingLevel,
} from "../../shared/protocol";
import { useAppStore } from "../state/appStore";
import { ModelSelector } from "./ModelSelector";
import { AppIcon } from "./icons";

type SettingsTab = "general" | "providers" | "mcp";

export function SettingsDialog({
  open,
  models,
  model,
  thinkingLevel,
  onModelSelect,
  onThinkingLevel,
  motionEnabled = true,
  onMotionEnabledChange,
  onClose,
  listProviders,
  loginWithApiKey,
  logoutProvider,
  loginWithOAuth,
  answerAuthPrompt,
  cancelProviderLogin,
  openExternal,
  onProvidersChanged,
  getMcpConfig,
  setMcpServerEnabled,
  importCursorMcp,
  openMcpConfigFile,
}: {
  open: boolean;
  models: ModelOption[];
  model: string;
  thinkingLevel: ThinkingLevel;
  onModelSelect: (model: string) => void;
  onThinkingLevel: (level: ThinkingLevel) => void;
  motionEnabled?: boolean;
  onMotionEnabledChange?: (enabled: boolean) => void;
  onClose: () => void;
  listProviders?: () => Promise<ProviderAuthStatus[]>;
  loginWithApiKey?: (providerId: string, apiKey: string) => Promise<{ name: string }>;
  logoutProvider?: (providerId: string) => Promise<void>;
  /** Start an account (OAuth) login. Progress/prompts stream via providerLogins. */
  loginWithOAuth?: (providerId: string) => Promise<{ name: string }>;
  /** Answer an interactive prompt surfaced during an account login. */
  answerAuthPrompt?: (promptId: string, answer: string) => Promise<void>;
  /** Cancel an in-flight account login. */
  cancelProviderLogin?: (providerId: string) => Promise<void>;
  /** Open an OAuth authorization link in the default browser. */
  openExternal?: (url: string) => Promise<void>;
  /** Called after login/logout so the parent can refresh model lists. */
  onProvidersChanged?: () => void | Promise<void>;
  /** Read the merged MCP config for the current workspace. */
  getMcpConfig?: () => Promise<McpConfigView>;
  /** Enable/disable an MCP server (writes .pi/mcp.json and reloads the runtime). */
  setMcpServerEnabled?: (name: string, enabled: boolean) => Promise<{ changed: boolean; path: string }>;
  /** Copy servers from Cursor's config into the project override. */
  importCursorMcp?: () => Promise<{ imported: string[]; skipped: string[] }>;
  /** Open the project MCP override file in the default editor. */
  openMcpConfigFile?: () => Promise<void>;
}) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [providers, setProviders] = useState<ProviderAuthStatus[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | undefined>();
  const [mcpConfig, setMcpConfig] = useState<McpConfigView | undefined>();
  const [mcpError, setMcpError] = useState<string | undefined>();

  const providerLogins = useAppStore((state) => state.providerLogins);
  const clearProviderLogin = useAppStore((state) => state.clearProviderLogin);
  /** Live adapter status for the current workspace (drives status dots). */
  const mcpStatus = useAppStore((state) => state.resources.mcp);

  // Keep props for App wiring; thinking is primarily controlled from the chatbox.
  void thinkingLevel;
  void onThinkingLevel;

  const refreshProviders = useCallback(async () => {
    if (!listProviders) {
      setProviders([]);
      setProvidersError("Provider API is unavailable. Fully quit and restart Pi Desktop.");
      return;
    }
    setProvidersLoading(true);
    setProvidersError(undefined);
    try {
      const next = await listProviders();
      const list = Array.isArray(next) ? next : [];
      setProviders(list);
      if (list.length === 0) {
        setProvidersError("No providers were returned by Pi. Restart the app and try again.");
      }
      setSelectedId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        const preferred = list.find((item) => item.configured) ?? list[0];
        return preferred?.id ?? "";
      });
    } catch (error) {
      setProviders([]);
      setProvidersError(error instanceof Error ? error.message : String(error));
    } finally {
      setProvidersLoading(false);
    }
  }, [listProviders]);

  const refreshMcpConfig = useCallback(async () => {
    if (!getMcpConfig) {
      setMcpConfig(undefined);
      setMcpError("MCP API is unavailable. Fully quit and restart Pi Desktop.");
      return;
    }
    try {
      const next = await getMcpConfig();
      setMcpConfig(next);
      setMcpError(undefined);
    } catch (error) {
      setMcpConfig(undefined);
      setMcpError(error instanceof Error ? error.message : String(error));
    }
  }, [getMcpConfig]);

  const toggleMcpServer = async (name: string, enabled: boolean) => {
    if (!setMcpServerEnabled) return;
    setBusy(true);
    setActionMessage(undefined);
    try {
      await setMcpServerEnabled(name, enabled);
      setActionMessage(enabled ? `Enabled ${name}` : `Disabled ${name}`);
      await refreshMcpConfig();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const importFromCursor = async () => {
    if (!importCursorMcp) return;
    setBusy(true);
    setActionMessage(undefined);
    try {
      const result = await importCursorMcp();
      if (result.imported.length > 0) {
        setActionMessage(
          `Imported from Cursor: ${result.imported.join(", ")}${result.skipped.length > 0 ? ` · skipped ${result.skipped.join(", ")}` : ""}`,
        );
      } else if (result.skipped.length > 0) {
        setActionMessage("Nothing new to import — Cursor servers already exist here");
      } else {
        setActionMessage("No Cursor MCP config found at ~/.cursor/mcp.json");
      }
      await refreshMcpConfig();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const openMcpFile = async () => {
    if (!openMcpConfigFile) return;
    setActionMessage(undefined);
    try {
      await openMcpConfigFile();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    if (!open) {
      setTab("general");
      setSelectedId("");
      setApiKeyDraft("");
      setActionMessage(undefined);
      setProvidersError(undefined);
      setMcpConfig(undefined);
      setMcpError(undefined);
      setBusy(false);
      // Reset the login UI. In-flight logins continue in the background:
      // the next provider_login_event recreates the entry automatically.
      const logins = useAppStore.getState().providerLogins;
      for (const providerId of Object.keys(logins)) {
        clearProviderLogin(providerId);
      }
      return;
    }
    if (tab === "providers") {
      // Drop finished logins from an earlier session so the panel shows a fresh button.
      const logins = useAppStore.getState().providerLogins;
      for (const [providerId, login] of Object.entries(logins)) {
        if (login.status !== "running") clearProviderLogin(providerId);
      }
      void refreshProviders();
    }
    if (tab === "mcp") {
      void refreshMcpConfig();
    }
  }, [open, tab, refreshProviders, refreshMcpConfig, clearProviderLogin]);

  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId),
    [providers, selectedId],
  );

  const oauthLogin = selected ? providerLogins[selected.id] : undefined;

  const connectedProviders = useMemo(
    () => providers.filter((provider) => provider.configured),
    [providers],
  );

  const connectProvider = async () => {
    if (!loginWithApiKey || !selected) return;
    const key = apiKeyDraft.trim();
    if (!key) {
      setActionMessage("Enter an API key first.");
      return;
    }
    setBusy(true);
    setActionMessage(undefined);
    try {
      const result = await loginWithApiKey(selected.id, key);
      setActionMessage(`Saved API key for ${result.name}. Stored in ~/.pi/agent/auth.json`);
      setApiKeyDraft("");
      await refreshProviders();
      await onProvidersChanged?.();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const disconnectProvider = async () => {
    if (!logoutProvider || !selected) return;
    setBusy(true);
    setActionMessage(undefined);
    try {
      await logoutProvider(selected.id);
      setActionMessage(`Removed stored credential for ${selected.name}. Environment variables are unchanged.`);
      setApiKeyDraft("");
      await refreshProviders();
      await onProvidersChanged?.();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const startOAuthLogin = async () => {
    if (!loginWithOAuth || !selected) return;
    setBusy(true);
    setActionMessage(undefined);
    try {
      const result = await loginWithOAuth(selected.id);
      clearProviderLogin(selected.id);
      setActionMessage(`Signed in to ${result.name}. Credential stored in ~/.pi/agent/auth.json`);
      await refreshProviders();
      await onProvidersChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Cancellation surfaces an error event; treat it as a quiet reset.
      clearProviderLogin(selected.id);
      if (message !== "Login cancelled") {
        setActionMessage(message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="palette-backdrop" role="dialog" aria-label="Pi settings" onClick={onClose}>
      <div className="settings-dialog settings-dialog-wide" onClick={(event) => event.stopPropagation()}>
        <div className="settings-heading">
          <div>
            <strong>Settings</strong>
            <p className="settings-subtitle">Models, providers, and session defaults</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings">
            <AppIcon name="x" size="sm" />
          </button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "general"}
            className={`settings-tab ${tab === "general" ? "active" : ""}`}
            onClick={() => setTab("general")}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "providers"}
            className={`settings-tab ${tab === "providers" ? "active" : ""}`}
            onClick={() => setTab("providers")}
          >
            Providers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mcp"}
            className={`settings-tab ${tab === "mcp" ? "active" : ""}`}
            onClick={() => setTab("mcp")}
          >
            MCP
          </button>
        </div>

        <div className="settings-body">
          {tab === "general" && (
            <>
              <section className="settings-section">
                <div className="settings-section-label">Available models</div>
                <div className="settings-field">
                  <div className="settings-field-meta">
                    <label>Default model</label>
                    <span>Models listed here come from connected providers</span>
                  </div>
                  <ModelSelector
                    className="settings-control"
                    models={models.filter((item) => item.available)}
                    current={model}
                    onSelect={onModelSelect}
                  />
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-section-label">Interface</div>
                <div className="settings-field">
                  <div className="settings-field-meta">
                    <label>Interface motion</label>
                    <span>Enable panel transitions, hover feedback, and other subtle animations</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-motion-toggle ${motionEnabled ? "is-on" : ""}`}
                    role="switch"
                    aria-label="Interface motion"
                    aria-checked={motionEnabled}
                    onClick={() => onMotionEnabledChange?.(!motionEnabled)}
                  >
                    <span className="settings-motion-track" aria-hidden="true">
                      <span className="settings-motion-thumb" />
                    </span>
                    <span>{motionEnabled ? "On" : "Off"}</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === "providers" && (
            <section className="settings-section">
              <div className="settings-section-label">Provider credentials</div>
              <p className="settings-providers-lead">
                Same as Pi <code>/login</code> and <code>/logout</code>. Connect with an API key or sign in with an
                account; credentials are saved to <code>~/.pi/agent/auth.json</code>. Environment variables still work
                but cannot be removed here.
              </p>

              {providersLoading && <p className="settings-providers-status">Loading providers…</p>}
              {providersError && <p className="settings-providers-error">{providersError}</p>}
              {actionMessage && <p className="settings-providers-status">{actionMessage}</p>}

              {!providersLoading && !providersError && providers.length === 0 && (
                <p className="settings-providers-status">No providers available.</p>
              )}

              {providers.length > 0 && (
                <>
                  <div className="settings-field">
                    <div className="settings-field-meta">
                      <label htmlFor="settings-provider-select">Provider</label>
                      <span>Pick a provider to connect or manage</span>
                    </div>
                    <div className="settings-select-wrap">
                      <select
                        id="settings-provider-select"
                        className="settings-control settings-provider-select"
                        aria-label="Select provider"
                        value={selectedId}
                        onChange={(event) => {
                          setSelectedId(event.target.value);
                          setApiKeyDraft("");
                          setActionMessage(undefined);
                        }}
                      >
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {providerStatusPrefix(provider)} {provider.name} ({provider.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selected && (
                    <div className="settings-provider-detail">
                      <div className="settings-provider-main">
                        <div className="settings-provider-title">
                          <strong>{selected.name}</strong>
                          <span className="settings-provider-id">{selected.id}</span>
                        </div>
                        <div className="settings-provider-meta">
                          <StatusBadge provider={selected} />
                          {selected.sourceLabel && selected.configured && (
                            <span className="settings-provider-source">{selected.sourceLabel}</span>
                          )}
                        </div>
                      </div>

                      {selected.hasApiKeyLogin && (
                        <div className="settings-provider-connect-stack">
                          <label className="settings-provider-key-field">
                            <span>API key</span>
                            <input
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              placeholder={`Paste ${selected.name} API key`}
                              value={apiKeyDraft}
                              onChange={(event) => setApiKeyDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void connectProvider();
                                }
                              }}
                            />
                          </label>
                          <div className="settings-provider-actions">
                            <button
                              type="button"
                              className="settings-provider-btn primary"
                              disabled={busy || !apiKeyDraft.trim()}
                              onClick={() => void connectProvider()}
                            >
                              {busy
                                ? "Saving…"
                                : selected.canLogout || selected.configured
                                  ? "Save / update key"
                                  : "Connect"}
                            </button>
                            {selected.canLogout && (
                              <button
                                type="button"
                                className="settings-provider-btn danger"
                                disabled={busy}
                                onClick={() => void disconnectProvider()}
                              >
                                {busy ? "…" : "Logout"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {selected.hasOAuthLogin && (
                        <div className="settings-provider-connect-stack settings-provider-oauth-stack">
                          <div className="settings-provider-oauth-heading">
                            <span>Account</span>
                            {oauthLogin?.status === "running" && <span className="settings-provider-oauth-state">Signing in…</span>}
                          </div>
                          {oauthLogin?.status === "running" ? (
                            <OAuthProgressPanel
                              provider={selected}
                              state={oauthLogin}
                              answerAuthPrompt={answerAuthPrompt}
                              cancelProviderLogin={cancelProviderLogin}
                              openExternal={openExternal}
                            />
                          ) : (
                            <div className="settings-provider-actions">
                              <button
                                type="button"
                                className="settings-provider-btn primary"
                                disabled={busy || !loginWithOAuth}
                                onClick={() => void startOAuthLogin()}
                              >
                                {busy ? "Starting…" : "Sign in with an account"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {!selected.hasApiKeyLogin && !selected.hasOAuthLogin && (
                        <p className="settings-provider-note">
                          No interactive login for this provider (ambient / local only).
                        </p>
                      )}
                    </div>
                  )}

                  {connectedProviders.length > 0 && (
                    <div className="settings-connected-block">
                      <div className="settings-section-label">Currently available</div>
                      <ul className="settings-connected-list">
                        {connectedProviders.map((provider) => (
                          <li key={provider.id}>
                            <button
                              type="button"
                              className={`settings-connected-item ${provider.id === selectedId ? "active" : ""}`}
                              onClick={() => {
                                setSelectedId(provider.id);
                                setApiKeyDraft("");
                                setActionMessage(undefined);
                              }}
                            >
                              <span className="settings-connected-name">{provider.name}</span>
                              <StatusBadge provider={provider} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "mcp" && (
            <section className="settings-section">
              <div className="settings-section-label">MCP servers</div>
              <p className="settings-providers-lead">
                Model Context Protocol servers are read from standard <code>mcp.json</code> files —
                global <code>~/.config/mcp/mcp.json</code> first, then the project’s{" "}
                <code>.pi/mcp.json</code> (highest precedence). pi-desk writes per-project overrides
                to <code>.pi/mcp.json</code>.
              </p>

              {mcpError && <p className="settings-providers-error">{mcpError}</p>}
              {actionMessage && <p className="settings-providers-status">{actionMessage}</p>}

              <div className="settings-field">
                <div className="settings-field-meta">
                  <label>Servers</label>
                  <span>Toggling a server writes the override and reloads the runtime</span>
                </div>
                {!mcpConfig ? (
                  <p className="settings-providers-status">Loading MCP config…</p>
                ) : mcpConfig.servers.length === 0 ? (
                  <p className="settings-providers-status">No MCP servers configured for this project.</p>
                ) : (
                  <ul className="settings-mcp-list">
                    {mcpConfig.servers.map((server) => {
                      const live = mcpStatus?.servers.find((item) => item.name === server.name);
                      return (
                        <li className="settings-mcp-row" key={server.name}>
                          <label className="settings-mcp-toggle">
                            <input
                              type="checkbox"
                              checked={!server.disabled}
                              disabled={busy || !setMcpServerEnabled}
                              onChange={() => void toggleMcpServer(server.name, server.disabled)}
                            />
                            <span className="settings-mcp-name">{server.name}</span>
                          </label>
                          <span className={`settings-mcp-state ${live?.status === "failed" ? "failed" : ""}`}>
                            {live
                              ? `${live.status}${live.toolCount > 0 ? ` · ${live.toolCount} tools` : ""}`
                              : server.disabled
                                ? "disabled"
                                : "not running"}
                          </span>
                          <small className="settings-mcp-source" title={server.source}>
                            {shortenMcpPath(server.source)}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="settings-mcp-actions">
                <button
                  type="button"
                  className="settings-provider-btn primary"
                  disabled={busy || !importCursorMcp}
                  onClick={() => void importFromCursor()}
                >
                  {busy ? "Working…" : "Import from Cursor"}
                </button>
                <button
                  type="button"
                  className="settings-provider-btn"
                  disabled={!openMcpConfigFile}
                  onClick={() => void openMcpFile()}
                >
                  Open config file
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="settings-footer">
          {tab === "general"
            ? "Switch model and effort from the chatbox right before you send."
            : tab === "providers"
              ? "Choose a provider from the dropdown, then connect with an API key or an account."
              : "Servers come from standard mcp.json files; the desktop writes per-project overrides."}
        </div>
      </div>
    </div>
  );
}

/** Shorten an mcp.json source path to its last two segments (e.g. …/.pi/mcp.json). */
function shortenMcpPath(path: string): string {
  if (!path) return "project";
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}

function providerStatusPrefix(provider: ProviderAuthStatus): string {
  if (!provider.configured) return "○";
  if (provider.source === "stored") return "●";
  if (provider.source === "environment" || provider.source === "runtime") return "◐";
  return "●";
}

function StatusBadge({ provider }: { provider: ProviderAuthStatus }) {
  if (!provider.configured) {
    return <span className="provider-badge off">Not connected</span>;
  }
  if (provider.source === "stored") {
    return <span className="provider-badge on">Connected</span>;
  }
  if (provider.source === "environment") {
    return <span className="provider-badge env">Env</span>;
  }
  if (provider.source === "runtime") {
    return <span className="provider-badge env">Runtime</span>;
  }
  return <span className="provider-badge on">Connected</span>;
}

function OAuthProgressPanel({
  provider,
  state,
  answerAuthPrompt,
  cancelProviderLogin,
  openExternal,
}: {
  provider: ProviderAuthStatus;
  state: { status: "running" | "done" | "error"; events: ProviderLoginEvent[] };
  answerAuthPrompt?: (promptId: string, answer: string) => Promise<void>;
  cancelProviderLogin?: (providerId: string) => Promise<void>;
  openExternal?: (url: string) => Promise<void>;
}) {
  const lastPrompt = useMemo(() => {
    for (let index = state.events.length - 1; index >= 0; index -= 1) {
      const event = state.events[index];
      if (event.type === "prompt") return event.prompt;
    }
    return undefined;
  }, [state.events]);

  return (
    <div className="settings-oauth-panel">
      <div className="settings-oauth-log">
        {state.events.map((event, index) =>
          event.type === "prompt" ? null : <OAuthEventRow key={index} event={event} openExternal={openExternal} />,
        )}
      </div>
      {lastPrompt && (
        <OAuthPromptForm
          key={lastPrompt.promptId}
          prompt={lastPrompt}
          onSubmit={async (value) => {
            if (!answerAuthPrompt) return;
            await answerAuthPrompt(lastPrompt.promptId, value);
          }}
        />
      )}
      {cancelProviderLogin && (
        <div className="settings-provider-actions">
          <button
            type="button"
            className="settings-provider-btn danger"
            onClick={() => void cancelProviderLogin(provider.id)}
          >
            Cancel login
          </button>
        </div>
      )}
    </div>
  );
}

function OAuthEventRow({
  event,
  openExternal,
}: {
  event: ProviderLoginEvent;
  openExternal?: (url: string) => Promise<void>;
}) {
  switch (event.type) {
    case "auth_url":
      return (
        <div className="settings-oauth-event">
          <span className="settings-oauth-event-icon"><AppIcon name="externalLink" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">
              {event.instructions ?? "Authorize in your browser to finish signing in."}
            </p>
            <button
              type="button"
              className="settings-oauth-link-btn"
              onClick={() => void openExternal?.(event.url)}
            >
              Open authorization page
            </button>
          </div>
        </div>
      );
    case "device_code":
      return (
        <div className="settings-oauth-event">
          <span className="settings-oauth-event-icon"><AppIcon name="keyboard" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">
              Enter code <strong>{event.userCode}</strong> at{" "}
              <button
                type="button"
                className="settings-oauth-link-btn"
                onClick={() => void openExternal?.(event.verificationUri)}
              >
                {event.verificationUri}
              </button>
              {event.expiresInSeconds ? ` · expires in ${Math.max(1, Math.round(event.expiresInSeconds / 60))} min` : ""}
            </p>
          </div>
        </div>
      );
    case "info":
      return (
        <div className="settings-oauth-event">
          <span className="settings-oauth-event-icon"><AppIcon name="info" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">{event.message}</p>
            {event.links?.map((link, index) => (
              <button
                key={index}
                type="button"
                className="settings-oauth-link-btn"
                onClick={() => void openExternal?.(link.url)}
              >
                {link.label ?? link.url}
              </button>
            ))}
          </div>
        </div>
      );
    case "progress":
      return (
        <div className="settings-oauth-event">
          <span className="settings-oauth-event-icon"><AppIcon name="circleDot" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">{event.message}</p>
          </div>
        </div>
      );
    case "done":
      return (
        <div className="settings-oauth-event success">
          <span className="settings-oauth-event-icon"><AppIcon name="check" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">Signed in to {event.name}.</p>
          </div>
        </div>
      );
    case "error":
      return (
        <div className="settings-oauth-event error">
          <span className="settings-oauth-event-icon"><AppIcon name="circleAlert" size="sm" /></span>
          <div className="settings-oauth-event-body">
            <p className="settings-oauth-event-text">{event.message}</p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function OAuthPromptForm({
  prompt,
  onSubmit,
}: {
  prompt: ProviderLoginPrompt;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(prompt.type === "select" ? (prompt.options?.[0]?.id ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (busy) return;
    if (prompt.type !== "select" && !value.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(value);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-oauth-prompt">
      <p className="settings-oauth-prompt-message">{prompt.message}</p>
      {prompt.type === "select" ? (
        <div className="settings-oauth-options" role="radiogroup" aria-label={prompt.message}>
          {prompt.options?.map((option) => (
            <label key={option.id} className="settings-oauth-option">
              <input
                type="radio"
                name={`oauth-select-${prompt.promptId}`}
                checked={value === option.id}
                onChange={() => setValue(option.id)}
              />
              <span className="settings-oauth-option-label">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type={prompt.type === "secret" ? "password" : "text"}
          autoComplete="off"
          spellCheck={false}
          placeholder={prompt.placeholder ?? ""}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
      )}
      <div className="settings-provider-actions">
        <button
          type="button"
          className="settings-provider-btn primary"
          disabled={busy || (prompt.type !== "select" && !value.trim())}
          onClick={() => void submit()}
        >
          {busy ? "Submitting…" : "Continue"}
        </button>
      </div>
      {error && <p className="settings-providers-error">{error}</p>}
    </div>
  );
}
