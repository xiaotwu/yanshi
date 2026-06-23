export const MASCOT_EXPRESSIONS = ["neutral", "happy", "thinking", "focused", "surprised", "error", "sleeping"] as const;

export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];

export type MascotSize = "rail" | "stage" | "hero";

export interface MascotRigProps {
  accessibleName: string;
  expression: MascotExpression;
  statusText: string;
  size?: MascotSize;
  reducedMotion?: boolean;
  className?: string;
}
