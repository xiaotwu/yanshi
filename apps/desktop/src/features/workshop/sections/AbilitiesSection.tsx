import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../../i18n";

const KNOWN_TOOLS = ["bash", "browser", "computer", "file", "terminal", "reviewer", "search"];

export interface AbilitiesSectionProps {
  profile: AgentProfileSummary;
}

/**
 * READ-ONLY — the runtime does not yet honor per-worker tool configuration.
 * Shows defaultTools as lit chips and other known tools dim. No interactive toggles.
 */
export function AbilitiesSection({ profile }: AbilitiesSectionProps) {
  const { t: _t } = useT();
  const litTools = new Set(profile.defaultTools);

  // Merge known tools with any profile tools not in the known list
  const allTools = [...new Set([...KNOWN_TOOLS, ...profile.defaultTools])];

  return (
    <div className="wi-section abilities-section">
      <div className="wi-tool-chips" aria-label={_t("workshop.abilities")}>
        {allTools.map((tool) => (
          <span
            key={tool}
            className={litTools.has(tool) ? "wi-tool-chip lit" : "wi-tool-chip dim"}
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
