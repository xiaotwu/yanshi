import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../../i18n";

export interface MindSectionProps {
  profile: AgentProfileSummary;
}

/**
 * READ-ONLY — the runtime does not yet honor per-worker model configuration.
 * Displays an honest "pending runtime support" note rather than a fake model selector.
 */
export function MindSection({ profile: _profile }: MindSectionProps) {
  const { t } = useT();

  return (
    <div className="wi-section mind-section">
      <p className="wi-pending-note">{t("workshop.pendingRuntime")}</p>
    </div>
  );
}
