import { useState, useEffect } from "react";
import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../../i18n";
import { useRuntimeStore } from "../../../stores/runtimeStore";

export interface IdentitySectionProps {
  profile: AgentProfileSummary;
}

export function IdentitySection({ profile }: IdentitySectionProps) {
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
        name: draft.name,
        accent: draft.accent,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wi-section identity-section">
      <label>
        {t("workshop.agentName")}
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => void save()}
        />
      </label>
      <label>
        {t("workshop.agentAccent")}
        <input
          type="color"
          value={draft.accent}
          onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
          onBlur={() => void save()}
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
