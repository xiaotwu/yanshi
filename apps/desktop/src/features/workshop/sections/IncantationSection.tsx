import { useState, useEffect } from "react";
import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../../i18n";
import { useRuntimeStore } from "../../../stores/runtimeStore";

export interface IncantationSectionProps {
  profile: AgentProfileSummary;
}

export function IncantationSection({ profile }: IncantationSectionProps) {
  const { t } = useT();
  const { saveAgentProfile } = useRuntimeStore();
  const [prompt, setPrompt] = useState(profile.prompt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrompt(profile.prompt);
  }, [profile.id, profile.prompt]);

  const save = async () => {
    setBusy(true);
    try {
      await saveAgentProfile(profile.id, { prompt });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wi-section incantation-section">
      <label>
        {t("workshop.agentPrompt")}
        <textarea
          className="wi-parchment-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
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
