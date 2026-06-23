import { MascotRig } from "./MascotRig";
import { MASCOT_ROLES } from "./types";
import type { MascotRigProps, MascotRole } from "./types";

export { MASCOT_ROLES };
export type { MascotRole };

export interface MascotSkinProps extends Omit<MascotRigProps, "skin"> {
  role: MascotRole;
}

export function mascotRoleFromStation(station: string | null | undefined): MascotRole {
  return MASCOT_ROLES.includes(station as MascotRole) ? (station as MascotRole) : "manager";
}

export function MascotSkin({ role, className, ...props }: MascotSkinProps) {
  const classes = ["yanshi-mascot-skin", `yanshi-mascot-skin--${role}`, className].filter(Boolean).join(" ");

  return <MascotRig {...props} skin={role} className={classes} />;
}
