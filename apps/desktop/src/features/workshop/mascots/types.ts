export const MASCOT_EXPRESSIONS = ["neutral", "happy", "thinking", "focused", "surprised", "error", "sleeping"] as const;
export const MASCOT_ROLES = ["manager", "browser", "computer", "file", "reviewer", "terminal"] as const;

export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];
export type MascotRole = (typeof MASCOT_ROLES)[number];

export type MascotSize = "rail" | "stage" | "hero";

export interface MascotRigProps {
  accessibleName: string;
  expression: MascotExpression;
  statusText: string;
  size?: MascotSize;
  skin?: MascotRole;
  reducedMotion?: boolean;
  className?: string;
}
