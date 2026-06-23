import type { MascotExpression, MascotRigProps } from "./types";
export { MASCOT_EXPRESSIONS } from "./types";
export type { MascotExpression, MascotRigProps, MascotSize } from "./types";

function expressionLayer(expression: MascotExpression) {
  switch (expression) {
    case "neutral":
      return (
        <g data-testid="mascot-expression-neutral" className="yanshi-mascot__expression">
          <rect className="yanshi-mascot__blank-eye" x="61" y="103" width="15" height="31" rx="4" />
          <rect className="yanshi-mascot__blank-eye" x="124" y="103" width="15" height="31" rx="4" />
          <path className="yanshi-mascot__mouth" d="M94 140 Q100 146 106 140" />
        </g>
      );
    case "happy":
      return (
        <g data-testid="mascot-expression-happy" className="yanshi-mascot__expression">
          <path d="M61 113 Q72 103 83 113" />
          <path d="M117 113 Q128 103 139 113" />
          <path className="yanshi-mascot__mouth yanshi-mascot__mouth--open" d="M89 133 Q100 150 111 133 Q100 140 89 133 Z" />
        </g>
      );
    case "thinking":
      return (
        <g data-testid="mascot-expression-thinking" className="yanshi-mascot__expression">
          <path d="M59 104 Q69 99 81 105" />
          <path d="M119 106 Q131 101 141 105" />
          <rect className="yanshi-mascot__blank-eye" x="62" y="110" width="13" height="25" rx="4" />
          <rect className="yanshi-mascot__blank-eye" x="125" y="110" width="13" height="25" rx="4" />
          <path className="yanshi-mascot__mouth" d="M93 143 L107 143" />
          <circle className="yanshi-mascot__thought-dot" cx="153" cy="84" r="4" />
          <circle className="yanshi-mascot__thought-dot" cx="165" cy="70" r="2.8" />
        </g>
      );
    case "focused":
      return (
        <g data-testid="mascot-expression-focused" className="yanshi-mascot__expression">
          <path d="M57 105 Q72 100 87 105" />
          <path d="M113 105 Q128 100 143 105" />
          <ellipse cx="72" cy="116" rx="7" ry="8" />
          <ellipse cx="128" cy="116" rx="7" ry="8" />
          <circle className="yanshi-mascot__eye-shine" cx="74" cy="113" r="2" />
          <circle className="yanshi-mascot__eye-shine" cx="130" cy="113" r="2" />
          <path className="yanshi-mascot__mouth" d="M94 140 L106 140" />
        </g>
      );
    case "surprised":
      return (
        <g data-testid="mascot-expression-surprised" className="yanshi-mascot__expression">
          <circle cx="72" cy="116" r="8" />
          <circle cx="128" cy="116" r="8" />
          <circle className="yanshi-mascot__eye-shine" cx="75" cy="113" r="2.2" />
          <circle className="yanshi-mascot__eye-shine" cx="131" cy="113" r="2.2" />
          <ellipse className="yanshi-mascot__mouth yanshi-mascot__mouth--open" cx="100" cy="140" rx="6" ry="8" />
        </g>
      );
    case "error":
      return (
        <g data-testid="mascot-expression-error" className="yanshi-mascot__expression">
          <path d="M61 106 L82 126" />
          <path d="M82 106 L61 126" />
          <path d="M118 106 L139 126" />
          <path d="M139 106 L118 126" />
          <path className="yanshi-mascot__mouth" d="M91 144 Q100 136 109 144" />
          <path className="yanshi-mascot__sweat" d="M153 97 C162 107 162 116 153 120 C144 116 144 107 153 97 Z" />
        </g>
      );
    case "sleeping":
      return (
        <g data-testid="mascot-expression-sleeping" className="yanshi-mascot__expression">
          <path d="M60 116 L84 116" />
          <path d="M116 116 L140 116" />
          <path className="yanshi-mascot__mouth" d="M94 141 Q100 138 106 141" />
          <text className="yanshi-mascot__sleep-text" x="153" y="88">
            z
          </text>
          <text className="yanshi-mascot__sleep-text yanshi-mascot__sleep-text--small" x="168" y="69">
            z
          </text>
        </g>
      );
  }
}

export function MascotRig({
  accessibleName,
  expression,
  statusText,
  size = "stage",
  reducedMotion = false,
  className,
}: MascotRigProps) {
  const classes = [
    "yanshi-mascot",
    `yanshi-mascot--${size}`,
    `yanshi-mascot--expr-${expression}`,
    reducedMotion ? "yanshi-mascot--reduced-motion" : "yanshi-mascot--animated",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={classes}
      role="img"
      aria-label={accessibleName}
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      data-expression={expression}
      data-size={size}
    >
      <title>{accessibleName}</title>
      <desc>{statusText}</desc>

      <g data-testid="mascot-shadow-ring" className="yanshi-mascot__shadow-ring">
        <ellipse cx="100" cy="222" rx="45" ry="10" />
        <ellipse className="yanshi-mascot__status-ring" cx="100" cy="220" rx="54" ry="14" />
      </g>

      <g data-testid="mascot-layer-back-hair" className="yanshi-mascot__layer yanshi-mascot__back-hair">
        <path d="M100 31 C59 31 37 58 38 95 C20 107 21 136 38 151 C29 160 30 177 40 186 C58 177 73 166 84 153 C93 161 107 161 116 153 C127 166 142 177 160 186 C170 177 171 160 162 151 C179 136 180 107 162 95 C163 58 141 31 100 31 Z" />
      </g>

      <g data-testid="mascot-layer-body" className="yanshi-mascot__layer yanshi-mascot__body">
        <path d="M71 154 H129 L142 218 C126 231 74 231 58 218 Z" />
        <path className="yanshi-mascot__sleeve" d="M70 168 L36 185" />
        <path className="yanshi-mascot__sleeve" d="M130 168 L164 185" />
        <ellipse className="yanshi-mascot__hand" cx="33" cy="188" rx="11" ry="12" />
        <ellipse className="yanshi-mascot__hand" cx="167" cy="188" rx="11" ry="12" />
        <rect className="yanshi-mascot__boot" x="79" y="219" width="19" height="16" rx="4" />
        <rect className="yanshi-mascot__boot" x="102" y="219" width="19" height="16" rx="4" />
      </g>

      <g data-testid="mascot-layer-apron-tab" className="yanshi-mascot__layer yanshi-mascot__apron-tab">
        <path d="M77 162 H123 L131 213 C113 221 87 221 69 213 Z" />
        <path className="yanshi-mascot__apron-stroke" d="M100 167 V210" />
        <path className="yanshi-mascot__apron-stroke" d="M76 193 H124" />
        <path className="yanshi-mascot__collar" d="M84 154 H116 L109 169 H91 Z" />
      </g>

      <g data-testid="mascot-layer-head" className="yanshi-mascot__layer yanshi-mascot__head">
        <path
          d="M100 42 C141 42 162 70 162 103 C162 137 136 158 100 158 C64 158 38 137 38 103 C38 70 59 42 100 42 Z"
          fill="var(--ym-face)"
          stroke="var(--ym-outline)"
        />
        <ellipse className="yanshi-mascot__blush" cx="58" cy="128" rx="9" ry="5" />
        <ellipse className="yanshi-mascot__blush" cx="142" cy="128" rx="9" ry="5" />
      </g>

      {expressionLayer(expression)}

      <g data-testid="mascot-layer-front-hair" className="yanshi-mascot__layer yanshi-mascot__front-hair">
        <path d="M42 101 C45 62 70 39 101 39 C132 39 156 61 158 101 C145 87 135 87 128 102 C113 95 105 79 101 59 C90 74 82 87 81 105 C69 100 58 88 51 72 C47 82 44 91 42 101 Z" />
        <path className="yanshi-mascot__hair-lock" d="M67 62 C82 65 92 74 99 88 C89 82 80 86 75 99 C70 86 66 75 67 62 Z" />
        <path className="yanshi-mascot__hair-shine" d="M63 50 C78 42 94 40 108 42 L99 55 L78 58 Z" />
        <path className="yanshi-mascot__hair-glint" d="M126 53 C136 62 140 72 139 83 L128 73 Z" />
      </g>

      <g data-testid="mascot-layer-dragon-horns" className="yanshi-mascot__layer yanshi-mascot__dragon-horns">
        <path d="M66 48 C47 27 52 7 72 2 C84 22 82 41 70 56 Z" />
        <path className="yanshi-mascot__horn-panel" d="M63 35 C65 25 69 17 74 11" />
        <path d="M134 48 C153 27 148 7 128 2 C116 22 118 41 130 56 Z" />
        <path className="yanshi-mascot__horn-panel" d="M137 35 C135 25 131 17 126 11" />
      </g>

      <g data-testid="mascot-layer-talisman-seal" className="yanshi-mascot__layer yanshi-mascot__talisman-seal">
        <path d="M123 187 L138 196 L130 211 L115 202 Z" />
        <path d="M122 196 L132 202" />
      </g>

      <g data-testid="mascot-layer-prop-slot" className="yanshi-mascot__layer yanshi-mascot__prop-slot">
        <rect x="155" y="154" width="17" height="27" rx="4" fill="var(--ym-accent)" stroke="var(--ym-outline)" />
        <path d="M160 164 L168 164 M160 172 L166 172" />
      </g>

      <g
        data-testid="mascot-state-accents"
        className="yanshi-mascot__layer yanshi-mascot__state-accents"
        data-reduced-motion={reducedMotion ? "true" : "false"}
      >
        <path d="M35 91 L43 87 M38 99 L47 99" />
        <path d="M160 88 L168 82 M166 96 L176 96" />
        <circle cx="151" cy="155" r="2.6" />
      </g>
    </svg>
  );
}
