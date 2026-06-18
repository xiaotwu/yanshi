import { useState } from "react";
import { BrainCircuit, ScrollText, SlidersHorizontal, Wrench, Bot } from "lucide-react";
import type { AgentProfileSummary } from "@yanshi/shared";

import { useT } from "../../i18n";
import { ROLE_ICONS } from "./WorkerRail";
import { IdentitySection } from "./sections/IdentitySection";
import { TemperamentSection } from "./sections/TemperamentSection";
import { MindSection } from "./sections/MindSection";
import { AbilitiesSection } from "./sections/AbilitiesSection";
import { IncantationSection } from "./sections/IncantationSection";

type InspectorTab = "temperament" | "mind" | "abilities" | "incantation";

export interface WorkerInspectorProps {
  profile: AgentProfileSummary;
}

export function WorkerInspector({ profile }: WorkerInspectorProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<InspectorTab>("temperament");

  const Icon = ROLE_ICONS[profile.station] ?? Bot;

  const tabs: Array<{ id: InspectorTab; icon: React.ReactNode; labelKey: string }> = [
    { id: "temperament", icon: <SlidersHorizontal size={18} />, labelKey: "workshop.temperament" },
    { id: "mind", icon: <BrainCircuit size={18} />, labelKey: "workshop.mind" },
    { id: "abilities", icon: <Wrench size={18} />, labelKey: "workshop.abilities" },
    { id: "incantation", icon: <ScrollText size={18} />, labelKey: "workshop.incantation" },
  ];

  return (
    <div className="worker-inspector">
      {/* Identity header */}
      <header className="wi-identity-header">
        <span className="wi-avatar" style={{ "--avatar-accent": profile.accent } as React.CSSProperties}>
          <Icon size={22} />
        </span>
        <div className="wi-identity-meta">
          <IdentitySection profile={profile} />
        </div>
      </header>

      {/* Icon tab strip */}
      <div className="wi-tab-strip">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-label={t(tab.labelKey as Parameters<typeof t>[0])}
            title={t(tab.labelKey as Parameters<typeof t>[0])}
            aria-pressed={activeTab === tab.id}
            className={`wi-tab-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Active section */}
      <div className="wi-section-panel">
        {activeTab === "temperament" && <TemperamentSection profile={profile} />}
        {activeTab === "mind" && <MindSection profile={profile} />}
        {activeTab === "abilities" && <AbilitiesSection profile={profile} />}
        {activeTab === "incantation" && <IncantationSection profile={profile} />}
      </div>
    </div>
  );
}
