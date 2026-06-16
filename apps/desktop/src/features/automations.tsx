import { Play, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { runtimeApi } from "../api/client";
import { Switch } from "../components/switch";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { useRuntimeStore } from "../stores/runtimeStore";

export function AutomationsPanel({ projectId }: { projectId: string }) {
  const { t } = useT();
  const [automations, setAutomations] = useState<import("@yanshi/shared").AutomationSummary[] | null>(null);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [interval, setIntervalValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = () =>
    runtimeApi
      .automations(projectId)
      .then((items) => {
        setAutomations(items);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .automations(projectId)
      .then((items) => {
        if (cancelled) return;
        setAutomations(items);
        setLoadFailed(false);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const create = async () => {
    if (!name.trim() || !task.trim()) return;
    setBusy(true);
    try {
      const minutes = interval.trim() ? Number(interval.trim()) : null;
      await runtimeApi.createAutomation({
        name: name.trim(),
        task: task.trim(),
        projectId,
        scheduleKind: minutes ? "interval" : "manual",
        intervalMinutes: minutes,
      });
      setName("");
      setTask("");
      setIntervalValue("");
      await refresh();
    } catch (err) {
      reportError("YANSHI_AUTOMATION_001", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="automations">
      <div className="automation-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("automation.name")} />
        <input value={task} onChange={(event) => setTask(event.target.value)} placeholder={t("automation.task")} />
        <input value={interval} onChange={(event) => setIntervalValue(event.target.value)} placeholder={t("automation.interval")} inputMode="numeric" />
        <button onClick={() => void create()} disabled={busy || !name.trim() || !task.trim()}>
          <Plus size={15} /> {t("automation.add")}
        </button>
      </div>
      {loadFailed ? (
        <p className="transcript-empty">
          {t("common.loadFailed")}{" "}
          <button className="link-button" onClick={() => void refresh()}>{t("error.retry")}</button>
        </p>
      ) : !automations ? (
        <p className="muted">{t("common.loading")}</p>
      ) : automations.length === 0 ? (
        <p className="transcript-empty">{t("automation.none")}</p>
      ) : (
        <div className="file-list">
          {automations.map((automation) => (
            <AutomationRow key={automation.id} automation={automation} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AutomationRow({ automation, onChanged }: { automation: import("@yanshi/shared").AutomationSummary; onChanged: () => Promise<void> | void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const schedule = automation.scheduleKind === "interval" ? t("automation.every", { minutes: automation.intervalMinutes ?? 0 }) : t("automation.manual");

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      reportError("YANSHI_AUTOMATION_001", err);
    } finally {
      setBusy(false);
      await onChanged();
    }
  };

  return (
    <div className="automation-row">
      <div className="automation-main">
        <strong>{automation.name}</strong>
        <small>
          {schedule}
          {automation.lastRunAt ? ` · ${t("automation.last", { time: new Date(automation.lastRunAt).toLocaleTimeString() })}` : ""}
        </small>
      </div>
      <button className="ghost-button" disabled={busy} title={t("automation.run")} onClick={() => void act(() => runtimeApi.runAutomation(automation.id))}>
        <Play size={15} /> {t("automation.run")}
      </button>
      <Switch
        checked={automation.enabled}
        disabled={busy}
        onChange={(enabled) => void act(() => runtimeApi.updateAutomation(automation.id, { enabled }))}
        ariaLabel={automation.name}
      />
      <button className="ghost-button danger-text" disabled={busy} title={t("menu.delete")} onClick={() => void act(() => runtimeApi.deleteAutomation(automation.id))}>
        <X size={15} />
      </button>
    </div>
  );
}

