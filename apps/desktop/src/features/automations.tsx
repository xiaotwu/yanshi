import { Play, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { runtimeApi } from "../api/client";
import { useRuntimeStore } from "../stores/runtimeStore";

export function AutomationsPanel({ projectId }: { projectId: string }) {
  const [automations, setAutomations] = useState<import("@yanshi/shared").AutomationSummary[] | null>(null);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [interval, setIntervalValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => runtimeApi.automations(projectId).then(setAutomations).catch(() => setAutomations([]));

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .automations(projectId)
      .then((items) => !cancelled && setAutomations(items))
      .catch(() => !cancelled && setAutomations([]));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const create = async () => {
    if (!name.trim() || !task.trim()) return;
    setBusy(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Could not create automation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="automations">
      <div className="automation-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <input value={task} onChange={(event) => setTask(event.target.value)} placeholder="Task" />
        <input value={interval} onChange={(event) => setIntervalValue(event.target.value)} placeholder="Every N min (optional)" inputMode="numeric" />
        <button onClick={() => void create()} disabled={busy || !name.trim() || !task.trim()}>
          <Plus size={15} /> Add
        </button>
      </div>
      {error && <p className="inline-error">{error}</p>}
      {!automations ? (
        <p className="muted">Loading…</p>
      ) : automations.length === 0 ? (
        <p className="transcript-empty">No automations yet.</p>
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
  const [busy, setBusy] = useState(false);
  const schedule = automation.scheduleKind === "interval" ? `every ${automation.intervalMinutes}m` : "manual";

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
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
          {automation.lastRunAt ? ` · last ${new Date(automation.lastRunAt).toLocaleTimeString()}` : ""}
        </small>
      </div>
      <button className="ghost-button" disabled={busy} title="Run now" onClick={() => void act(() => runtimeApi.runAutomation(automation.id))}>
        <Play size={15} /> Run
      </button>
      <label className="switch" title={automation.enabled ? "Enabled" : "Disabled"}>
        <input
          type="checkbox"
          checked={automation.enabled}
          disabled={busy}
          onChange={(event) => void act(() => runtimeApi.updateAutomation(automation.id, { enabled: event.target.checked }))}
        />
      </label>
      <button className="ghost-button danger-text" disabled={busy} title="Delete" onClick={() => void act(() => runtimeApi.deleteAutomation(automation.id))}>
        <X size={15} />
      </button>
    </div>
  );
}

