import { useState, useEffect } from "react";
import type { AgentProfileSummary } from "@yanshi/shared";

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

  useEffect(() => {
    setModel(profile.model ?? "");
  }, [profile.id, profile.model]);

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
          aria-label={t("workshop.modelLabel")}
          value={model}
          placeholder={t("workshop.modelHint")}
          onChange={(e) => setModel(e.target.value)}
        />
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
