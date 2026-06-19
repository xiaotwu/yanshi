import { useState, useEffect } from "react";
import type { AgentProfileSummary } from "@yanshi/shared";

import { runtimeApi } from "../../../api/client";
import { useT } from "../../../i18n";
import { useRuntimeStore } from "../../../stores/runtimeStore";

export interface MindSectionProps {
  profile: AgentProfileSummary;
}

export function MindSection({ profile }: MindSectionProps) {
  const { t } = useT();
  const { saveAgentProfile } = useRuntimeStore();
  const [model, setModel] = useState(profile.model ?? "");
  const [busy, setBusy] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    setModel(profile.model ?? "");
  }, [profile.id, profile.model]);

  useEffect(() => {
    runtimeApi.providerModels().then((res) => {
      setAvailableModels(res.models);
    }).catch(() => {
      // Optional convenience — silently ignore errors; the input stays free-text.
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await saveAgentProfile(profile.id, { model: model || null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wi-section mind-section">
      <label>
        {t("workshop.modelLabel")}
        <input
          type="text"
          list="worker-model-options"
          aria-label={t("workshop.modelLabel")}
          value={model}
          placeholder={t("workshop.modelHint")}
          onChange={(e) => setModel(e.target.value)}
        />
        <datalist id="worker-model-options">
          {availableModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <p className="wi-hint">{t("workshop.modelHint")}</p>
      <div className="settings-actions">
        <button onClick={() => void save()} disabled={busy}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
