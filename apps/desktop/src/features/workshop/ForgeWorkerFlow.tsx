import { Bot } from "lucide-react";
import { useState } from "react";

import { useT } from "../../i18n";
import { STATION_OPTIONS } from "../../lib/shared";
import { ROLE_ICONS } from "./WorkerRail";

export interface ForgeWorkerFlowProps {
  onCreate: (body: { name: string; station: string }) => void;
  onClose: () => void;
}

export function ForgeWorkerFlow({ onCreate, onClose }: ForgeWorkerFlowProps) {
  const { t } = useT();
  const [station, setStation] = useState<string>(STATION_OPTIONS[0]);
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), station });
  };

  return (
    <div className="forge-flow" role="dialog" aria-label={t("workshop.forgeWorker")}>
      <div className="forge-flow-inner">
        <p className="forge-flow-label">{t("workshop.forgeStation")}</p>
        <div className="forge-station-grid" role="group" aria-label={t("workshop.forgeStation")}>
          {STATION_OPTIONS.map((opt) => {
            const Icon = ROLE_ICONS[opt] ?? Bot;
            return (
              <button
                key={opt}
                type="button"
                className={`forge-station-btn${station === opt ? " active" : ""}`}
                aria-label={opt}
                aria-pressed={station === opt}
                onClick={() => setStation(opt)}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <label className="forge-flow-label" htmlFor="forge-name-input">
          {t("workshop.forgeName")}
        </label>
        <input
          id="forge-name-input"
          className="forge-name-input"
          type="text"
          value={name}
          placeholder={t("workshop.forgeName")}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="forge-flow-actions">
          <button
            type="button"
            className="forge-btn-cancel"
            onClick={onClose}
          >
            {t("workshop.forgeCancel")}
          </button>
          <button
            type="button"
            className="forge-btn-create"
            disabled={!name.trim()}
            onClick={handleCreate}
          >
            {t("workshop.forgeCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}
