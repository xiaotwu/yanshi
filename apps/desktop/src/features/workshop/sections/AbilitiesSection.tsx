import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../../i18n";
import { Switch } from "../../../components/switch";
import { useRuntimeStore } from "../../../stores/runtimeStore";

/** The four capability tools that the runtime enforces from the whitelist. */
const CAPABILITY_TOOLS = ["browser", "computer", "terminal", "file"] as const;
type CapabilityTool = (typeof CAPABILITY_TOOLS)[number];

export interface AbilitiesSectionProps {
  profile: AgentProfileSummary;
}

export function AbilitiesSection({ profile }: AbilitiesSectionProps) {
  const { t } = useT();
  const { saveAgentProfile, appSettings } = useRuntimeStore();

  /** Returns true if the global setting allows this capability tool. */
  const isGloballyEnabled = (tool: CapabilityTool): boolean => {
    if (tool === "browser") return appSettings?.browserToolEnabled ?? true;
    if (tool === "computer") return appSettings?.computerToolEnabled ?? true;
    if (tool === "terminal") return appSettings?.terminalToolEnabled ?? true;
    // "file" has no global toggle — always allowed.
    return true;
  };

  const enabled = new Set(profile.defaultTools);

  const toggle = async (tool: CapabilityTool, nowOn: boolean) => {
    const next = nowOn
      ? [...profile.defaultTools, tool]
      : profile.defaultTools.filter((t) => t !== tool);
    await saveAgentProfile(profile.id, { defaultTools: next });
  };

  const isEmpty = profile.defaultTools.length === 0;

  return (
    <div className="wi-section abilities-section">
      {isEmpty && (
        <p className="wi-hint">{t("workshop.abilitiesInheritNote")}</p>
      )}
      <div className="wi-ability-rows">
        {CAPABILITY_TOOLS.map((tool) => {
          const globalOn = isGloballyEnabled(tool);
          const checkedOn = enabled.has(tool);
          return (
            <div
              key={tool}
              className="wi-ability-row"
              title={!globalOn ? t("workshop.abilityGloballyOff") : undefined}
            >
              <span className="wi-ability-label">{tool}</span>
              <Switch
                checked={checkedOn}
                disabled={!globalOn}
                ariaLabel={tool}
                onChange={(next) => void toggle(tool, next)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
