import type { AgentProfileSummary, ApprovalSummary, ProviderHealth, RunSummary, YanshiEvent } from "@yanshi/shared";

import type { Translator } from "../../../lib/shared";
import type { TKey } from "../../../i18n/en";
import { deriveMascotState } from "./state";
import { mascotRoleFromStation } from "./skins";
import type { MascotExpression, MascotRole } from "./types";
import type { MascotPresentation, MascotPresentationState } from "./state";

export interface MascotRuntimeSlices {
  activeRunId: string | null;
  runs: RunSummary[];
  approvals: ApprovalSummary[];
  events: Array<{ seq: number; event: YanshiEvent }>;
  providerHealth: ProviderHealth | null;
  reducedMotion: boolean;
}

export interface MascotViewModel {
  role: MascotRole;
  expression: MascotExpression;
  statusText: string;
  accessibleName: string;
  state: MascotPresentationState;
  busy: boolean;
  reducedMotion: boolean;
}

export type MascotViewModelsByProfileId = Record<string, MascotViewModel>;
export type MascotViewModelsByStation = Partial<Record<MascotRole, MascotViewModel>>;

const ROLE_LABEL_KEYS: Record<MascotRole, TKey> = {
  manager: "agent.manager",
  browser: "agent.browser",
  computer: "agent.computer",
  file: "agent.file",
  reviewer: "agent.reviewer",
  terminal: "agent.terminal",
};

const MASCOT_STATUS_KEYS: Record<MascotPresentationState, TKey> = {
  idle: "mascot.status.idle",
  thinking: "mascot.status.thinking",
  working: "mascot.status.working",
  talking: "mascot.status.talking",
  awaitingApproval: "mascot.status.awaitingApproval",
  success: "mascot.status.success",
  completed: "mascot.status.completed",
  failed: "mascot.status.failed",
  stopped: "mascot.status.stopped",
  offline: "mascot.status.offline",
};

function toViewModel(
  profile: AgentProfileSummary,
  role: MascotRole,
  presentation: MascotPresentation,
  t: Translator,
): MascotViewModel {
  const statusText = t(MASCOT_STATUS_KEYS[presentation.state]);
  const roleLabel = t(ROLE_LABEL_KEYS[role]);

  return {
    role,
    expression: presentation.expression,
    statusText,
    accessibleName: t("mascot.accessibleName", { name: profile.name, role: roleLabel, status: statusText }),
    state: presentation.state,
    busy: presentation.busy,
    reducedMotion: presentation.motion === "none",
  };
}

export function fallbackMascotViewModel(profile: AgentProfileSummary, t: Translator, reducedMotion = false): MascotViewModel {
  const role = mascotRoleFromStation(profile.station);
  return toViewModel(
    profile,
    role,
    {
      state: "idle",
      expression: "neutral",
      motion: reducedMotion ? "none" : "idle",
      busy: false,
      celebrate: false,
    },
    t,
  );
}

export function stationMascotViewModel(station: string, t: Translator, reducedMotion = false): MascotViewModel {
  const role = mascotRoleFromStation(station);
  const statusText = t("mascot.status.idle");
  const roleLabel = t(ROLE_LABEL_KEYS[role]);

  return {
    role,
    expression: "neutral",
    statusText,
    accessibleName: t("mascot.stationAccessibleName", { role: roleLabel, status: statusText }),
    state: "idle",
    busy: false,
    reducedMotion,
  };
}

export function buildMascotViewModels(
  profiles: AgentProfileSummary[],
  runtime: MascotRuntimeSlices,
  t: Translator,
): {
  byProfileId: MascotViewModelsByProfileId;
  byStation: MascotViewModelsByStation;
} {
  const byProfileId: MascotViewModelsByProfileId = {};
  const byStation: MascotViewModelsByStation = {};

  for (const profile of profiles) {
    const role = mascotRoleFromStation(profile.station);
    const presentation = deriveMascotState({
      worker: { id: profile.id, role: profile.role || profile.station },
      activeRunId: runtime.activeRunId,
      runs: runtime.runs,
      approvals: runtime.approvals,
      events: runtime.events,
      providerHealth: runtime.providerHealth,
      reducedMotion: runtime.reducedMotion,
    });
    const model = toViewModel(profile, role, presentation, t);
    byProfileId[profile.id] = model;
    byStation[role] ??= model;
  }

  return { byProfileId, byStation };
}
