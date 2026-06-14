// Yanshi Puppets (偃师傀) — the original chibi worker identity for the Atelier.
//
// One master design, six role variants, a compact expression language. Authored as a layered
// SVG part system (flat cel shapes, bold soft outlines) so the same art renders everywhere:
// rasterized to billboard sprite textures inside the 3D office, and inline in the 2D
// simplified/fallback views. Endfield-adjacent in mood, original to Yanshi: the mechanical
// "puppet-ear" fins + the red mechanism-seal pin are the crafted-being cues.
//
// Honest scope: these are real, generated-at-build SVG assets (no GLB/animation claimed).
// Expression states are selected from real runtime status; life states stay decorative.

import type { AtelierRole } from "./characters";

// ---------------------------------------------------------------------------------------------
// Palette — restrained, game-like. Warm red is the only "punch" color and is used sparingly.

export const PUPPET_PALETTE = {
  outline: "#23262a",
  hair: "#33373d",
  hairShine: "#4c545e",
  hairGlint: "#5d7a8c",
  skin: "#f2e8dc",
  skinShade: "#e3d2c2",
  blush: "#e8b3a0",
  jacket: "#2f3237",
  jacketLight: "#3c4047",
  collar: "#f2e8dc",
  red: "#d24b42",
  panel: "#6fb3c7",
  white: "#fdfbf7",
} as const;

export type PuppetExpression = "content" | "focused" | "sleepy" | "panic" | "proud" | "slack";

export interface PuppetRoleArt {
  role: AtelierRole;
  /** Role accent (scarf, fin panel tint, prop). Muted, never neon. */
  accent: string;
  /** Darker companion of the accent for outlines/shadow shapes. */
  accentDeep: string;
  /** Ear-fin variant — part of the silhouette language. */
  fins: "twin" | "antenna" | "swept" | "low";
  /** One extra headwear detail layered with the bangs. */
  headDetail: "none" | "monocle" | "headset" | "hairpin" | "hood";
  /** Tiny floating prop beside the body. */
  prop: "board" | "stamp" | "compass" | "cursor" | "folder" | "console";
}

export const PUPPET_ROLES: Record<AtelierRole, PuppetRoleArt> = {
  manager: { role: "manager", accent: "#d9a04c", accentDeep: "#9c6f2e", fins: "antenna", headDetail: "none", prop: "board" },
  reviewer: { role: "reviewer", accent: "#c96a4a", accentDeep: "#8f4630", fins: "low", headDetail: "monocle", prop: "stamp" },
  browser: { role: "browser", accent: "#6fb3c7", accentDeep: "#477e90", fins: "twin", headDetail: "none", prop: "compass" },
  computer: { role: "computer", accent: "#7a86c2", accentDeep: "#535d92", fins: "twin", headDetail: "headset", prop: "cursor" },
  file: { role: "file", accent: "#8fae9b", accentDeep: "#5f7e6c", fins: "low", headDetail: "hairpin", prop: "folder" },
  terminal: { role: "terminal", accent: "#4f8d83", accentDeep: "#35635c", fins: "swept", headDetail: "hood", prop: "console" },
};

export function puppetRoleArt(role: string): PuppetRoleArt {
  return PUPPET_ROLES[role as AtelierRole] ?? PUPPET_ROLES.file;
}

// ---------------------------------------------------------------------------------------------
// SVG part builders. ViewBox is 200x240; the head dominates (chibi ~62% head).

const P = PUPPET_PALETTE;
const O = `stroke="${P.outline}" stroke-linejoin="round" stroke-linecap="round"`;

/** Mechanical puppet-ear fins — Yanshi's signature silhouette element. */
function fins(art: PuppetRoleArt): string {
  const panel = (d: string) => `<path d="${d}" fill="${art.accent}" opacity="0.85"/>`;
  const light = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${P.red}"/>`;
  switch (art.fins) {
    case "antenna":
      // Single tall fin tilted right + a stub on the left — the coordinator mark.
      return `
        <path d="M118 38 L138 -2 L154 14 L142 30 L150 38 L126 52 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M130 30 L141 9 L148 17 L138 30 Z")}
        ${light(143, 14)}
        <path d="M66 46 L50 22 L42 40 L56 54 Z" fill="${P.hair}" ${O} stroke-width="6"/>`;
    case "twin":
      // Symmetric angular twin fins.
      return `
        <path d="M58 48 L30 4 L18 30 L34 42 L26 52 L52 62 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M44 40 L31 16 L24 30 L38 42 Z")}
        <path d="M142 48 L170 4 L182 30 L166 42 L174 52 L148 62 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M156 40 L169 16 L176 30 L162 42 Z")}
        ${light(170, 28)}`;
    case "swept":
      // Backswept blades — quick, terminal-runner feel.
      return `
        <path d="M56 50 L18 26 L26 48 L48 60 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M44 50 L26 36 L31 47 L44 54 Z")}
        <path d="M144 50 L182 26 L174 48 L152 60 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M156 50 L174 36 L169 47 L156 54 Z")}
        ${light(176, 32)}`;
    case "low":
      // Small low side-fins — quieter desk-worker silhouette.
      return `
        <path d="M48 64 L22 48 L28 68 L46 76 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        <path d="M152 64 L178 48 L172 68 L154 76 Z" fill="${P.hair}" ${O} stroke-width="6"/>
        ${panel("M160 62 L172 54 L169 64 L158 68 Z")}
        ${light(168, 58)}`;
  }
}

/** Back hair silhouette behind the face — soft spiky ends past the chin. */
function backHair(): string {
  return `<path d="M100 18
    C 52 18 30 52 30 92
    C 30 116 34 138 28 158 L 44 150 L 50 168 L 64 156 L 72 172 L 84 162
    L 100 170 L 116 162 L 128 172 L 136 156 L 150 168 L 156 150 L 172 158
    C 166 138 170 116 170 92
    C 170 52 148 18 100 18 Z" fill="${P.hair}" ${O} stroke-width="7"/>`;
}

/** Face plate (skin) with a soft jaw. */
function face(): string {
  return `<path d="M100 44
    C 142 44 162 72 162 104
    C 162 136 136 156 100 156
    C 64 156 38 136 38 104
    C 38 72 58 44 100 44 Z" fill="${P.skin}" ${O} stroke-width="6"/>`;
}

/** Layered messy bangs over the brow — asymmetric depths, dipping close to the eyes. */
function bangs(art: PuppetRoleArt): string {
  const glint = `<path d="M126 52 C 134 60 138 70 139 82 L 128 72 Z" fill="${P.hairGlint}" opacity="0.8"/>`;
  const seal =
    art.headDetail === "hood"
      ? ""
      : `<g transform="translate(141 64)">
          <circle r="7.5" fill="${P.red}"/>
          <circle r="2.6" fill="${P.hair}"/>
          <rect x="-1.1" y="-7.5" width="2.2" height="4" fill="${P.hair}"/>
        </g>`;
  return `
    <path d="M36 100
      C 34 56 62 34 100 34
      C 138 34 166 56 164 100
      L 152 82 L 146 106 L 132 76 L 122 104 L 106 68 L 96 108 L 82 72 L 70 102 L 58 78 L 46 104 Z"
      fill="${P.hair}" ${O} stroke-width="6"/>
    <path d="M104 70 L 96 106 L 88 92 Z" fill="${P.hair}"/>
    <path d="M60 50 C 72 42 88 38 100 38 L 96 52 L 78 56 Z" fill="${P.hairShine}" opacity="0.7"/>
    ${glint}
    ${seal}`;
}

/** Headwear details layered on top of the bangs. */
function headDetail(art: PuppetRoleArt): string {
  switch (art.headDetail) {
    case "monocle":
      return `<circle cx="128" cy="116" r="14" fill="none" stroke="${art.accentDeep}" stroke-width="3.5"/>
        <path d="M140 106 L 148 98" stroke="${art.accentDeep}" stroke-width="3.5" stroke-linecap="round"/>`;
    case "headset":
      return `
        <path d="M40 96 C 44 60 70 40 100 40 C 130 40 156 60 160 96" fill="none" stroke="${art.accentDeep}" stroke-width="7" stroke-linecap="round"/>
        <rect x="28" y="92" width="16" height="26" rx="7" fill="${art.accent}" ${O} stroke-width="4"/>
        <rect x="156" y="92" width="16" height="26" rx="7" fill="${art.accent}" ${O} stroke-width="4"/>`;
    case "hairpin":
      return `<g transform="translate(60 70) rotate(-18)">
          <rect x="-12" y="-2.5" width="24" height="5" rx="2.5" fill="${art.accent}" stroke="${P.outline}" stroke-width="2.5"/>
          <rect x="-12" y="4" width="16" height="5" rx="2.5" fill="${art.accent}" stroke="${P.outline}" stroke-width="2.5"/>
        </g>`;
    case "hood":
      return `
        <path d="M30 110 C 22 56 58 26 100 26 C 142 26 178 56 170 110
          C 166 84 160 70 152 62 C 156 78 156 92 154 102
          C 144 64 124 48 100 48 C 76 48 56 64 46 102 C 44 92 44 78 48 62 C 40 70 34 84 30 110 Z"
          fill="${P.jacket}" ${O} stroke-width="6"/>
        <circle cx="100" cy="34" r="5" fill="${art.accent}"/>`;
    case "none":
      return "";
  }
}

/** Expression layer: eyes + mouth + tiny motion cues. Minimal, low-pressure, cute. */
function expression(expr: PuppetExpression): string {
  const blush = `
    <ellipse cx="56" cy="128" rx="9" ry="5" fill="${P.blush}" opacity="0.65"/>
    <ellipse cx="144" cy="128" rx="9" ry="5" fill="${P.blush}" opacity="0.65"/>`;
  const eye = (cx: number, d: string) => `<path d="${d}" transform="translate(${cx} 0)" fill="none" stroke="${P.outline}" stroke-width="5" stroke-linecap="round"/>`;
  switch (expr) {
    case "content":
      // Closed content arcs ︶ + tiny soft smile.
      return `${blush}
        ${eye(68, "M-12 116 Q 0 124 12 116")}
        ${eye(132, "M-12 116 Q 0 124 12 116")}
        <path d="M93 140 Q 100 146 107 140" fill="none" stroke="${P.outline}" stroke-width="4.5" stroke-linecap="round"/>`;
    case "focused":
      // Open attentive eyes with a soft upper lid + straight little mouth.
      return `${blush}
        <path d="M57 109 Q 68 105 79 109" fill="none" stroke="${P.outline}" stroke-width="4" stroke-linecap="round"/>
        <path d="M121 109 Q 132 105 143 109" fill="none" stroke="${P.outline}" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="68" cy="120" rx="7" ry="8" fill="${P.outline}"/>
        <ellipse cx="132" cy="120" rx="7" ry="8" fill="${P.outline}"/>
        <circle cx="70.5" cy="117" r="2.2" fill="${P.white}"/>
        <circle cx="134.5" cy="117" r="2.2" fill="${P.white}"/>
        <path d="M95 141 L 105 141" stroke="${P.outline}" stroke-width="4.5" stroke-linecap="round"/>`;
    case "sleepy":
      // Heavy flat lids + drowsy mouth + floating Zz.
      return `${blush}
        ${eye(68, "M-12 118 L 12 118")}
        ${eye(132, "M-12 118 L 12 118")}
        <path d="M95 142 Q 100 139 105 142" fill="none" stroke="${P.outline}" stroke-width="4.5" stroke-linecap="round"/>
        <g fill="${P.outline}" opacity="0.85" font-family="ui-rounded, 'Hiragino Maru Gothic ProN', sans-serif" font-weight="700">
          <text x="158" y="92" font-size="22">z</text>
          <text x="172" y="74" font-size="15">z</text>
        </g>`;
    case "panic":
      // >< eyes + sweat drop + wobbly mouth.
      return `${blush}
        ${eye(68, "M-11 110 L 0 118 L -11 126")}
        ${eye(132, "M11 110 L 0 118 L 11 126")}
        <path d="M92 142 Q 96 138 100 142 Q 104 146 108 142" fill="none" stroke="${P.outline}" stroke-width="4" stroke-linecap="round"/>
        <path d="M162 100 C 168 108 168 114 162 117 C 156 114 156 108 162 100 Z" fill="${P.panel}" stroke="${P.outline}" stroke-width="2.5"/>`;
    case "proud":
      // Happy closed arcs + open little triangle-ish mouth (the reference grin, our shapes).
      return `${blush}
        ${eye(68, "M-12 118 Q 0 108 12 118")}
        ${eye(132, "M-12 118 Q 0 108 12 118")}
        <path d="M90 136 Q 100 152 110 136 Q 100 142 90 136 Z" fill="${P.outline}"/>
        <path d="M150 96 L 154 88 M158 99 L 165 94" stroke="${P.outline}" stroke-width="3" stroke-linecap="round"/>`;
    case "slack":
      // Half-lidded sidelong look + flat mouth — quietly chaotic.
      return `${blush}
        <path d="M56 112 L 80 112" stroke="${P.outline}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M120 112 L 144 112" stroke="${P.outline}" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="74" cy="119" rx="6" ry="5.5" fill="${P.outline}"/>
        <ellipse cx="138" cy="119" rx="6" ry="5.5" fill="${P.outline}"/>
        <path d="M94 141 L 106 141" stroke="${P.outline}" stroke-width="4" stroke-linecap="round"/>
        <path d="M118 146 Q 124 150 130 146" fill="none" stroke="${P.outline}" stroke-width="3" opacity="0.6"/>`;
  }
}

/** Tiny smock body: snug accent scarf at the neck, red strap detail, small mitt hands, shoes. */
function body(art: PuppetRoleArt): string {
  return `
    <path d="M100 160
      C 120 160 132 172 135 196 L 138 220 C 139 229 130 234 100 234 C 70 234 61 229 62 220 L 65 196
      C 68 172 80 160 100 160 Z" fill="${P.jacket}" ${O} stroke-width="6"/>
    <path d="M74 168 C 84 177 116 177 126 168 L 129 179 C 116 189 84 189 71 179 Z"
      fill="${art.accent}" ${O} stroke-width="4.5"/>
    <path d="M118 188 L 126 224" stroke="${P.red}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
    <ellipse cx="66" cy="198" rx="8.5" ry="9.5" fill="${P.skin}" ${O} stroke-width="4.5"/>
    <ellipse cx="134" cy="198" rx="8.5" ry="9.5" fill="${P.skin}" ${O} stroke-width="4.5"/>
    <rect x="76" y="228" width="21" height="10" rx="5" fill="${P.jacketLight}" ${O} stroke-width="4"/>
    <rect x="103" y="228" width="21" height="10" rx="5" fill="${P.jacketLight}" ${O} stroke-width="4"/>`;
}

/** Tiny floating role prop beside the puppet. */
function prop(art: PuppetRoleArt): string {
  const g = (inner: string) => `<g transform="translate(168 178)">${inner}</g>`;
  switch (art.prop) {
    case "board":
      return g(`<rect x="-12" y="-16" width="24" height="32" rx="4" fill="${P.white}" ${O} stroke-width="4"/>
        <rect x="-6" y="-20" width="12" height="7" rx="3" fill="${art.accent}" ${O} stroke-width="3"/>
        <path d="M-6 -6 L 6 -6 M-6 2 L 6 2 M-6 10 L 2 10" stroke="${art.accentDeep}" stroke-width="2.5" stroke-linecap="round"/>`);
    case "stamp":
      return g(`<path d="M-9 4 L 9 4 L 7 -8 C 7 -14 -7 -14 -7 -8 Z" fill="${art.accent}" ${O} stroke-width="4"/>
        <rect x="-12" y="4" width="24" height="8" rx="3" fill="${art.accentDeep}" ${O} stroke-width="3.5"/>
        <circle cx="0" cy="-14" r="4" fill="${P.red}"/>`);
    case "compass":
      return g(`<circle r="14" fill="${P.white}" ${O} stroke-width="4"/>
        <path d="M-5 5 L 2 -7 L 5 -5 L -2 7 Z" fill="${P.red}"/>
        <circle r="2" fill="${P.outline}"/>`);
    case "cursor":
      return g(`<rect x="-13" y="-13" width="26" height="26" rx="6" fill="${art.accent}" ${O} stroke-width="4"/>
        <path d="M-4 -7 L 6 1 L 0 2 L 3 8 L -1 9 L -3 4 L -7 7 Z" fill="${P.white}" stroke="${P.outline}" stroke-width="2"/>`);
    case "folder":
      return g(`<path d="M-13 -8 L -4 -8 L -1 -12 L 12 -12 L 12 10 L -13 10 Z" fill="${art.accent}" ${O} stroke-width="4"/>
        <path d="M-13 -2 L 12 -2" stroke="${art.accentDeep}" stroke-width="2.5"/>`);
    case "console":
      return g(`<rect x="-14" y="-11" width="28" height="22" rx="4" fill="#23262a" stroke="${art.accent}" stroke-width="3.5"/>
        <path d="M-8 -4 L -3 0 L -8 4 M 0 5 L 8 5" stroke="${art.accent}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`);
  }
}

// ---------------------------------------------------------------------------------------------
// Assembly + caches

export function puppetSvg(role: string, expr: PuppetExpression): string {
  const art = puppetRoleArt(role);
  // Explicit pixel size so Image/TextureLoader rasterizes crisply for sprite textures
  // (≈2× the largest in-scene display size).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -14 220 264" width="440" height="528">
    ${fins(art)}
    ${backHair()}
    ${body(art)}
    ${face()}
    ${bangs(art)}
    ${headDetail(art)}
    ${expression(expr)}
    ${prop(art)}
  </svg>`;
}

const dataUrlCache = new Map<string, string>();

export function puppetDataUrl(role: string, expr: PuppetExpression): string {
  const key = `${role}:${expr}`;
  let url = dataUrlCache.get(key);
  if (!url) {
    url = `data:image/svg+xml;utf8,${encodeURIComponent(puppetSvg(role, expr))}`;
    dataUrlCache.set(key, url);
  }
  return url;
}

/** Maps live agent state to an expression. Task states win; life states only when idle. */
export function puppetExpression(status: string, lifeAction: string | null | undefined): PuppetExpression {
  if (status === "working") return "focused";
  if (status === "blocked" || status === "failed") return "panic";
  if (status === "waiting_approval") return "focused";
  if (status === "done") return "proud";
  if (lifeAction === "nap") return "sleepy";
  if (lifeAction === "playing_phone" || lifeAction === "chatting_with_neighbor") return "slack";
  return "content";
}
