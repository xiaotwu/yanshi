import { useState, useEffect } from "react";
import type { AgentProfileSummary, BehaviorMode } from "@yanshi/shared";

import { useT } from "../../../i18n";
import { BEHAVIOR_OPTIONS, STATION_OPTIONS } from "../../../lib/shared";
import { useRuntimeStore } from "../../../stores/runtimeStore";

export interface TemperamentSectionProps {
  profile: AgentProfileSummary;
}

export function TemperamentSection({ profile }: TemperamentSectionProps) {
  const { t } = useT();
  const { saveAgentProfile } = useRuntimeStore();
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(profile);
  }, [profile.id]);

  const save = async () => {
    setBusy(true);
    try {
      await saveAgentProfile(draft.id, {
        station: draft.station,
        behaviorMode: draft.behaviorMode,
        taskPriority: draft.taskPriority,
        personality: draft.personality,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wi-section temperament-section">
      <label>
        {t("workshop.agentStation")}
        <select
          value={draft.station}
          onChange={(e) => setDraft({ ...draft, station: e.target.value })}
        >
          {STATION_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("workshop.behavior")}
        <select
          value={draft.behaviorMode}
          onChange={(e) => setDraft({ ...draft, behaviorMode: e.target.value as BehaviorMode })}
        >
          {BEHAVIOR_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("workshop.agentPriority", { value: String(draft.taskPriority) })}
        <input
          type="range"
          min={1}
          max={10}
          value={draft.taskPriority}
          onChange={(e) => setDraft({ ...draft, taskPriority: Number(e.target.value) })}
        />
      </label>
      <label>
        {t("workshop.agentPersonality")}
        <input
          value={draft.personality}
          onChange={(e) => setDraft({ ...draft, personality: e.target.value })}
        />
      </label>
      <div className="settings-actions">
        <button onClick={() => void save()} disabled={busy}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
