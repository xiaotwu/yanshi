import {
  Activity,
  Bot,
  Cloud,
  HardDrive,
  Plug,
  Plus,
  Save,
  Server,
  Settings2,
  Sparkles,
  Trash2,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ExternalAgentConfig, IntegrationStatus, McpServerConfig, WorkshopPackSummary } from "@yanshi/shared";

import { Modal, ModalHeader } from "../components/modal";
import { Switch } from "../components/switch";
import { useT } from "../i18n";
import type { TKey } from "../i18n/en";
import { notify } from "../lib/notices";
import { useRuntimeStore } from "../stores/runtimeStore";

const STATUS_KEY: Record<IntegrationStatus, TKey> = {
  not_configured: "integrations.status.notConfigured",
  configured: "integrations.status.configured",
  starting: "integrations.status.starting",
  connected: "integrations.status.connected",
  ready: "integrations.status.ready",
  error: "integrations.status.error",
  not_implemented: "integrations.status.notImplemented",
};

function StatusBadge({ status }: { status: IntegrationStatus | "available" | "customEndpoint" | "notImplemented" | "configured" }) {
  const { t } = useT();
  const key =
    status === "available"
      ? "providers.status.available"
      : status === "customEndpoint"
        ? "providers.status.customEndpoint"
        : status === "notImplemented"
          ? "providers.status.notImplemented"
          : STATUS_KEY[status as IntegrationStatus];
  return <span className={`status-badge ${status}`}>{t(key as TKey)}</span>;
}

/** Compact integration card row: icon, name + one-line detail, badges, icon-only actions. */
function IntegrationCard({
  icon,
  name,
  subtitle,
  children,
  onConfigure,
  switchControl,
}: {
  icon: React.ReactNode;
  name: string;
  subtitle?: string;
  children?: React.ReactNode;
  onConfigure: () => void;
  switchControl?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="integration-row card">
      {icon}
      <button className="integration-name" onClick={onConfigure}>
        {name}
        {subtitle && <small className="muted ellipsis">{subtitle}</small>}
      </button>
      {children}
      <button className="icon-button ghost" onClick={onConfigure} title={t("integrations.configure")} aria-label={t("integrations.configure")}>
        <Settings2 size={15} />
      </button>
      {switchControl}
    </div>
  );
}

/** Icon-only modal action button with a mandatory accessible label. */
function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent,
  danger,
}: {
  icon: typeof Save;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`icon-action${accent ? " accent" : ""}${danger ? " danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <Icon size={16} />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// External Agents (ACP) — real minimal foundation: stdio launch + initialize handshake. Statuses
// and capabilities come from the live connection only; prompts/tools are not routed yet.

export function ExternalAgentsSection() {
  const { t } = useT();
  const { aiIntegrations, saveAiIntegrations, loadAiIntegrations, loading } = useRuntimeStore();
  const [editing, setEditing] = useState<ExternalAgentConfig | null>(null);

  useEffect(() => {
    if (!aiIntegrations) void loadAiIntegrations();
  }, [aiIntegrations, loadAiIntegrations]);

  const agents = aiIntegrations?.externalAgents ?? [];

  const upsert = async (agent: ExternalAgentConfig) => {
    const next = agents.some((item) => item.id === agent.id) ? agents.map((item) => (item.id === agent.id ? agent : item)) : [...agents, agent];
    await saveAiIntegrations({ externalAgents: next });
  };
  const remove = async (id: string) => {
    await saveAiIntegrations({ externalAgents: agents.filter((item) => item.id !== id) });
    setEditing(null);
  };
  const setEnabled = (agent: ExternalAgentConfig, enabled: boolean) =>
    void saveAiIntegrations({ externalAgents: agents.map((item) => (item.id === agent.id ? { ...item, enabled } : item)) });

  return (
    <div className="settings-panel wide">
      <h3>{t("integrations.agents.title")}</h3>
      <p className="muted">{t("integrations.agents.intro")}</p>
      <div className="integration-list">
        {agents.length === 0 && <p className="muted">{t("integrations.agents.empty")}</p>}
        {agents.map((agent) => (
          <IntegrationCard
            key={agent.id}
            icon={<Bot size={16} />}
            name={agent.name}
            subtitle={`${agent.protocol === "acp" ? "ACP" : t("integrations.agents.custom")}${agent.command ? ` · ${agent.command}` : agent.endpoint ? ` · ${agent.endpoint}` : ""}`}
            onConfigure={() => setEditing(agent)}
            switchControl={<Switch checked={agent.enabled} onChange={(enabled) => setEnabled(agent, enabled)} ariaLabel={agent.name} disabled={loading} />}
          >
            <StatusBadge status={agent.status} />
          </IntegrationCard>
        ))}
      </div>
      <div className="settings-actions">
        <button
          className="icon-action accent"
          onClick={() =>
            setEditing({ id: `ea_${Date.now().toString(36)}`, name: "", protocol: "acp", args: [], env: {}, enabled: false, status: "not_configured", capabilities: [] })
          }
          title={t("integrations.agents.add")}
          aria-label={t("integrations.agents.add")}
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="muted small">{t("integrations.agents.foundation")}</p>
      {editing && (
        <ExternalAgentDialog
          agent={agents.find((item) => item.id === editing.id) ?? editing}
          exists={agents.some((item) => item.id === editing.id)}
          onSave={upsert}
          onRemove={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ExternalAgentDialog({
  agent,
  exists,
  onSave,
  onRemove,
  onClose,
}: {
  agent: ExternalAgentConfig;
  exists: boolean;
  onSave: (agent: ExternalAgentConfig) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const { connectExternalAgent, disconnectExternalAgent, loading } = useRuntimeStore();
  const [name, setName] = useState(agent.name);
  const [protocol, setProtocol] = useState(agent.protocol);
  const [command, setCommand] = useState(agent.command ?? "");
  const [args, setArgs] = useState(agent.args.join(" "));
  const [endpoint, setEndpoint] = useState(agent.endpoint ?? "");
  const [env, setEnv] = useState(
    Object.entries(agent.env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );

  const parseEnv = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of env.split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return result;
  };

  const collect = (): ExternalAgentConfig => ({
    ...agent,
    name: name.trim(),
    protocol,
    command: command.trim() || null,
    args: args.trim() ? args.trim().split(/\s+/) : [],
    endpoint: endpoint.trim() || null,
    env: parseEnv(),
  });

  const save = () => void onSave(collect());
  // Connect persists the edited config first so the launch always uses what the user sees.
  const connect = async () => {
    await onSave(collect());
    await connectExternalAgent(agent.id);
  };
  const connected = agent.status === "connected" || agent.status === "starting";
  const canConnect = protocol === "acp" && Boolean(command.trim()) && Boolean(name.trim());

  return (
    <Modal onClose={onClose} size="md" labelledBy="agent-dialog-title">
      <ModalHeader title={exists ? agent.name : t("integrations.agents.add")} id="agent-dialog-title" onClose={onClose} />
      <div className="modal-body settings-form rows">
        <label>
          {t("integrations.name")}
          <input value={name} onChange={(event) => setName(event.target.value)} data-autofocus />
        </label>
        <label>
          {t("integrations.protocol")}
          <select value={protocol} onChange={(event) => setProtocol(event.target.value as "acp" | "custom")}>
            <option value="acp">ACP (Agent Client Protocol)</option>
            <option value="custom">{t("integrations.agents.custom")}</option>
          </select>
        </label>
        <label>
          {t("integrations.command")}
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npx my-acp-agent" spellCheck={false} />
        </label>
        <label>
          {t("integrations.args")}
          <input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="--stdio" spellCheck={false} />
        </label>
        <label>
          {t("integrations.env")}
          <textarea value={env} onChange={(event) => setEnv(event.target.value)} placeholder="KEY=value" rows={2} spellCheck={false} />
        </label>
        <label>
          {t("integrations.endpoint")}
          <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://localhost:9100" spellCheck={false} />
          <small className="muted">{t("integrations.agents.endpointNote")}</small>
        </label>

        {exists && (
          <div className="integration-live">
            <StatusBadge status={agent.status} />
            {agent.capabilities.length > 0 && (
              <div className="provider-caps">
                {agent.capabilities.map((cap) => (
                  <span key={cap} className="cap-badge">
                    {cap}
                  </span>
                ))}
              </div>
            )}
            {agent.lastError && (
              <small className="muted error-detail">
                {t("integrations.agents.lastError")}: {agent.lastError}
              </small>
            )}
          </div>
        )}
        <p className="muted small">{t("integrations.agents.foundation")}</p>
      </div>
      <div className="modal-actions icons">
        {exists && <IconAction icon={Trash2} label={t("common.remove")} onClick={() => void onRemove(agent.id)} danger />}
        {exists &&
          (connected ? (
            <IconAction icon={Unplug} label={t("integrations.disconnect")} onClick={() => void disconnectExternalAgent(agent.id)} disabled={loading} />
          ) : (
            <IconAction icon={Plug} label={t("integrations.connect")} onClick={() => void connect()} disabled={loading || !canConnect} />
          ))}
        <IconAction icon={Save} label={t("common.save")} onClick={save} disabled={!name.trim()} accent />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// MCP Servers — persisted configuration only; no runtime MCP client exists yet, statuses honest.

export function McpServersSection() {
  const { t } = useT();
  const { aiIntegrations, saveAiIntegrations, loadAiIntegrations, loading } = useRuntimeStore();
  const [editing, setEditing] = useState<McpServerConfig | null>(null);

  useEffect(() => {
    if (!aiIntegrations) void loadAiIntegrations();
  }, [aiIntegrations, loadAiIntegrations]);

  const servers = aiIntegrations?.mcpServers ?? [];

  const upsert = async (server: McpServerConfig) => {
    const next = servers.some((item) => item.id === server.id) ? servers.map((item) => (item.id === server.id ? server : item)) : [...servers, server];
    await saveAiIntegrations({ mcpServers: next });
  };
  const remove = async (id: string) => {
    await saveAiIntegrations({ mcpServers: servers.filter((item) => item.id !== id) });
    setEditing(null);
  };
  const setEnabled = (server: McpServerConfig, enabled: boolean) =>
    void saveAiIntegrations({ mcpServers: servers.map((item) => (item.id === server.id ? { ...item, enabled } : item)) });

  return (
    <div className="settings-panel wide">
      <h3>{t("integrations.mcp.title")}</h3>
      <p className="muted">{t("integrations.mcp.intro")}</p>
      <div className="integration-list">
        {servers.length === 0 && <p className="muted">{t("integrations.mcp.empty")}</p>}
        {servers.map((server) => (
          <IntegrationCard
            key={server.id}
            icon={<Server size={16} />}
            name={server.name}
            subtitle={`${server.transport}${server.transport === "stdio" ? (server.command ? ` · ${server.command}` : "") : server.url ? ` · ${server.url}` : ""}`}
            onConfigure={() => setEditing(server)}
            switchControl={<Switch checked={server.enabled} onChange={(enabled) => setEnabled(server, enabled)} ariaLabel={server.name} disabled={loading} />}
          >
            <StatusBadge status={server.status} />
          </IntegrationCard>
        ))}
      </div>
      <div className="settings-actions">
        <button
          className="icon-action accent"
          onClick={() => setEditing({ id: `mcp_${Date.now().toString(36)}`, name: "", transport: "stdio", args: [], env: {}, enabled: false, status: "not_configured", tools: [] })}
          title={t("integrations.mcp.add")}
          aria-label={t("integrations.mcp.add")}
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="muted small">{t("integrations.mcp.honest")}</p>
      {editing && (
        <McpServerDialog server={editing} exists={servers.some((item) => item.id === editing.id)} onSave={upsert} onRemove={remove} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function McpServerDialog({
  server,
  exists,
  onSave,
  onRemove,
  onClose,
}: {
  server: McpServerConfig;
  exists: boolean;
  onSave: (server: McpServerConfig) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(server.name);
  const [transport, setTransport] = useState(server.transport);
  const [command, setCommand] = useState(server.command ?? "");
  const [args, setArgs] = useState(server.args.join(" "));
  const [url, setUrl] = useState(server.url ?? "");
  const [env, setEnv] = useState(
    Object.entries(server.env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );

  const parseEnv = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of env.split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return result;
  };

  const save = () =>
    void onSave({
      ...server,
      name: name.trim(),
      transport,
      command: command.trim() || null,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      url: url.trim() || null,
      env: parseEnv(),
    });

  return (
    <Modal onClose={onClose} size="md" labelledBy="mcp-dialog-title">
      <ModalHeader title={exists ? server.name : t("integrations.mcp.add")} id="mcp-dialog-title" onClose={onClose} />
      <div className="modal-body settings-form rows">
        <label>
          {t("integrations.name")}
          <input value={name} onChange={(event) => setName(event.target.value)} data-autofocus />
        </label>
        <label>
          {t("integrations.transport")}
          <select value={transport} onChange={(event) => setTransport(event.target.value as "stdio" | "http" | "sse")}>
            <option value="stdio">stdio</option>
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
          </select>
        </label>
        {transport === "stdio" ? (
          <>
            <label>
              {t("integrations.command")}
              <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npx" spellCheck={false} />
            </label>
            <label>
              {t("integrations.args")}
              <input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem" spellCheck={false} />
            </label>
          </>
        ) : (
          <label>
            {t("integrations.url")}
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://localhost:3000/mcp" spellCheck={false} />
          </label>
        )}
        <label>
          {t("integrations.env")}
          <textarea value={env} onChange={(event) => setEnv(event.target.value)} placeholder="KEY=value" rows={2} spellCheck={false} />
        </label>
        {exists && <StatusBadge status={server.status} />}
        <p className="muted small">{t("integrations.mcp.honest")}</p>
      </div>
      <div className="modal-actions icons">
        {exists && <IconAction icon={Trash2} label={t("common.remove")} onClick={() => void onRemove(server.id)} danger />}
        <IconAction icon={Save} label={t("common.save")} onClick={save} disabled={!name.trim()} accent />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Skills — honest aggregation of real configuration (agent instructions + workshop packs).
// Skills are instructions/config applied to agents, not executable plugins; the copy says so.

type SkillEntry =
  | { kind: "agent"; id: string; name: string; instructions: string; personality: string }
  | { kind: "pack"; id: string; pack: WorkshopPackSummary };

export function SkillsSection() {
  const { t } = useT();
  const { agentProfiles, workshopPacks, loadAgentProfiles, setWorkshopPackEnabled, loading } = useRuntimeStore();
  const [detail, setDetail] = useState<SkillEntry | null>(null);

  useEffect(() => {
    if (agentProfiles.length === 0) void loadAgentProfiles();
  }, [agentProfiles.length, loadAgentProfiles]);

  return (
    <div className="settings-panel wide">
      <h3>{t("integrations.skills.title")}</h3>
      <p className="muted">{t("integrations.skills.intro")}</p>
      <div className="integration-list">
        {agentProfiles.map((profile) => (
          <IntegrationCard
            key={profile.id}
            icon={<Sparkles size={16} />}
            name={profile.name}
            subtitle={`${t("integrations.skills.builtIn")} · ${profile.prompt || profile.personality ? t("integrations.skills.hasInstructions") : t("integrations.skills.noInstructions")}`}
            onConfigure={() => setDetail({ kind: "agent", id: profile.id, name: profile.name, instructions: profile.prompt ?? "", personality: profile.personality ?? "" })}
          >
            <span className="status-badge configured">{t("integrations.skills.agent")}</span>
          </IntegrationCard>
        ))}
        {workshopPacks.map((pack) => (
          <IntegrationCard
            key={pack.id}
            icon={<Sparkles size={16} />}
            name={pack.name}
            subtitle={`${t("integrations.skills.workshop")} · v${pack.version} · ${pack.contentTypes.join(", ")}`}
            onConfigure={() => setDetail({ kind: "pack", id: pack.id, pack })}
            switchControl={
              <Switch checked={pack.enabled} onChange={(enabled) => void setWorkshopPackEnabled(pack.id, enabled)} ariaLabel={pack.name} disabled={loading} />
            }
          >
            <span className={`status-badge ${pack.enabled ? "configured" : "not_configured"}`}>
              {pack.enabled ? t("workshop.enable") : t("workshop.disable")}
            </span>
          </IntegrationCard>
        ))}
        {agentProfiles.length === 0 && workshopPacks.length === 0 && <p className="muted">{t("integrations.skills.empty")}</p>}
      </div>
      <p className="muted small">{t("integrations.skills.honest")}</p>
      {detail && <SkillDetailDialog entry={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SkillDetailDialog({ entry, onClose }: { entry: SkillEntry; onClose: () => void }) {
  const { t } = useT();
  const name = entry.kind === "agent" ? entry.name : entry.pack.name;
  return (
    <Modal onClose={onClose} size="md" labelledBy="skill-dialog-title">
      <ModalHeader title={name} id="skill-dialog-title" onClose={onClose} />
      <div className="modal-body settings-form rows">
        <dl className="runtime-details">
          <dt>{t("integrations.skills.source")}</dt>
          <dd>{entry.kind === "agent" ? t("integrations.skills.builtIn") : t("integrations.skills.workshop")}</dd>
          {entry.kind === "pack" && (
            <>
              <dt>{t("integrations.skills.version")}</dt>
              <dd>v{entry.pack.version}</dd>
              <dt>{t("integrations.skills.appliesTo")}</dt>
              <dd>{entry.pack.contentTypes.join(", ") || "—"}</dd>
            </>
          )}
        </dl>
        {entry.kind === "agent" && (
          <>
            <span className="settings-nav-label">{t("integrations.skills.instructions")}</span>
            {entry.instructions || entry.personality ? (
              <pre className="skill-instructions">{[entry.personality, entry.instructions].filter(Boolean).join("\n\n")}</pre>
            ) : (
              <p className="muted">{t("integrations.skills.noInstructions")}</p>
            )}
          </>
        )}
        <p className="muted small">{t("integrations.skills.honest")}</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// LLM Providers — compact catalog rows + a per-provider config modal. Only the OpenAI-compatible
// adapter has real runtime code; statuses stay honest and the working save/test flow is preserved.

type ProviderStatus = "available" | "customEndpoint" | "notImplemented";
type Cap = "reasoning" | "tools" | "vision" | "streaming";
export interface ProviderCatalogEntry {
  id: string;
  name: string;
  local: boolean;
  status: ProviderStatus;
  caps: Cap[];
  hint?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: "openai", name: "OpenAI", local: false, status: "available", caps: ["reasoning", "tools", "vision", "streaming"], hint: "https://api.openai.com/v1" },
  { id: "openai-compatible", name: "OpenAI Compatible", local: false, status: "available", caps: ["reasoning", "tools", "vision", "streaming"] },
  { id: "anthropic", name: "Anthropic", local: false, status: "notImplemented", caps: ["reasoning", "tools", "vision", "streaming"] },
  { id: "gemini", name: "Google Gemini", local: false, status: "notImplemented", caps: ["reasoning", "tools", "vision", "streaming"] },
  { id: "openrouter", name: "OpenRouter", local: false, status: "customEndpoint", caps: ["tools", "vision", "streaming"], hint: "https://openrouter.ai/api/v1" },
  { id: "deepseek", name: "DeepSeek", local: false, status: "customEndpoint", caps: ["reasoning", "tools", "streaming"], hint: "https://api.deepseek.com/v1" },
  { id: "mistral", name: "Mistral", local: false, status: "customEndpoint", caps: ["tools", "streaming"], hint: "https://api.mistral.ai/v1" },
  { id: "ollama", name: "Ollama", local: true, status: "customEndpoint", caps: ["tools", "streaming"], hint: "http://localhost:11434/v1" },
  { id: "lmstudio", name: "LM Studio", local: true, status: "customEndpoint", caps: ["tools", "streaming"], hint: "http://localhost:1234/v1" },
  { id: "vllm", name: "vLLM / SGLang", local: true, status: "customEndpoint", caps: ["tools", "streaming"], hint: "http://localhost:8000/v1" },
  { id: "custom", name: "Custom provider", local: false, status: "customEndpoint", caps: [] },
];

const PREFERRED_ACTIONS = ["chat", "coding", "everyday"] as const;

export function ProvidersSection() {
  const { t } = useT();
  const { providerSettings, appSettings } = useRuntimeStore();
  const [configuring, setConfiguring] = useState<ProviderCatalogEntry | null>(null);

  // The single active provider config is OpenAI-compatible; the catalog row whose hint matches the
  // saved base URL (or the generic compatible row) is the "active" one.
  const activeId = PROVIDER_CATALOG.find((entry) => entry.hint && providerSettings?.baseUrl === entry.hint)?.id ?? "openai-compatible";
  const preferredActions = appSettings?.preferredActions ?? {};

  return (
    <div className="settings-panel wide">
      <h3>{t("integrations.providers.title")}</h3>
      <p className="muted">{t("providers.intro")}</p>
      <div className="integration-list providers">
        {PROVIDER_CATALOG.map((entry) => {
          const isActive = entry.id === activeId && Boolean(providerSettings?.apiKeyConfigured || providerSettings?.model);
          const preferredFor = PREFERRED_ACTIONS.filter((action) => preferredActions[action] === entry.id);
          return (
            <IntegrationCard
              key={entry.id}
              icon={entry.local ? <HardDrive size={15} /> : <Cloud size={15} />}
              name={entry.name}
              subtitle={entry.hint}
              onConfigure={() => setConfiguring(entry)}
            >
              {preferredFor.length > 0 && (
                <span className="status-badge default-badge" title={preferredFor.map((action) => t(`providers.action.${action}` as TKey)).join(" · ")}>
                  {t("providers.preferred")}
                </span>
              )}
              <span className={`local-badge ${entry.local ? "local" : "cloud"}`}>{entry.local ? t("providers.local") : t("providers.cloud")}</span>
              <StatusBadge status={isActive ? "configured" : entry.status} />
            </IntegrationCard>
          );
        })}
      </div>
      <p className="muted small">{t("integrations.providers.honest")}</p>
      {configuring && <ProviderConfigDialog entry={configuring} isActive={configuring.id === activeId} onClose={() => setConfiguring(null)} />}
    </div>
  );
}

function ProviderConfigDialog({ entry, isActive, onClose }: { entry: ProviderCatalogEntry; isActive: boolean; onClose: () => void }) {
  const { t } = useT();
  const { providerSettings, providerHealth, saveProviderSettings, checkProviderHealth, appSettings, saveAppSettings, loading } = useRuntimeStore();
  const useSaved = isActive || entry.id === "openai-compatible" || entry.id === "custom";
  const [baseUrl, setBaseUrl] = useState(useSaved ? (providerSettings?.baseUrl ?? entry.hint ?? "") : (entry.hint ?? ""));
  const [model, setModel] = useState(useSaved ? (providerSettings?.model ?? "gpt-4o-mini") : "");
  const [apiKey, setApiKey] = useState("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const configurable = entry.status !== "notImplemented";
  const preferredActions = appSettings?.preferredActions ?? {};

  const save = async () => {
    const ok = await saveProviderSettings({ baseUrl: baseUrl.trim(), model: model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
    setApiKey("");
    if (ok) notify(t("notice.providerSaved"));
  };
  const test = async () => {
    await checkProviderHealth();
    setLastChecked(new Date().toLocaleTimeString());
  };
  const togglePreferred = (action: (typeof PREFERRED_ACTIONS)[number]) => {
    const next = { ...preferredActions };
    if (next[action] === entry.id) delete next[action];
    else next[action] = entry.id;
    void saveAppSettings({ preferredActions: next });
  };

  return (
    <Modal onClose={onClose} size="md" labelledBy="provider-dialog-title">
      <ModalHeader title={entry.name} id="provider-dialog-title" onClose={onClose} />
      <div className="modal-body settings-form rows">
        {entry.caps.length > 0 && (
          <div className="provider-caps">
            {entry.caps.map((cap) => (
              <span key={cap} className="cap-badge">
                {t(`providers.cap.${cap}` as TKey)}
              </span>
            ))}
          </div>
        )}
        {configurable ? (
          <>
            <label>
              {t("providers.baseUrl")}
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
            </label>
            <label>
              {t("providers.model")}
              <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} placeholder={t("providers.modelManual")} />
            </label>
            <label>
              {t("providers.apiKey")}
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={providerSettings?.apiKeyConfigured ? t("providers.status.configured") : t("providers.status.notConfigured")}
                type="password"
              />
            </label>

            <div className="preferred-actions">
              <span className="settings-nav-label">{t("providers.preferredFor")}</span>
              <div className="preferred-chips">
                {PREFERRED_ACTIONS.map((action) => (
                  <button
                    key={action}
                    className={`preferred-chip${preferredActions[action] === entry.id ? " active" : ""}`}
                    onClick={() => togglePreferred(action)}
                    aria-pressed={preferredActions[action] === entry.id}
                  >
                    {t(`providers.action.${action}` as TKey)}
                  </button>
                ))}
              </div>
              <small className="muted">{t("providers.preferredHint")}</small>
            </div>

            {providerHealth && (
              <div className="integration-live">
                <StatusBadge status={providerHealth.ok ? "ready" : "error"} />
                <small className="muted error-detail">
                  {providerHealth.detail}
                  {lastChecked ? ` · ${t("integrations.providers.lastChecked", { time: lastChecked })}` : ""}
                </small>
              </div>
            )}
            <p className="muted small">{t("integrations.providers.keySafety")}</p>
          </>
        ) : (
          <p className="muted">{t("integrations.providers.notImplementedDetail")}</p>
        )}
      </div>
      {configurable && (
        <div className="modal-actions icons">
          <IconAction icon={Activity} label={t("providers.test")} onClick={() => void test()} disabled={loading} />
          <IconAction icon={Save} label={t("common.save")} onClick={save} disabled={loading || !baseUrl.trim() || !model.trim()} accent />
        </div>
      )}
    </Modal>
  );
}
