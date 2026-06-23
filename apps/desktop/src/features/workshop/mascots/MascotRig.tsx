import type { MascotExpression, MascotRigProps } from "./types";
export { MASCOT_EXPRESSIONS } from "./types";
export type { MascotExpression, MascotRigProps, MascotSize } from "./types";

function expressionLayer(expression: MascotExpression) {
  switch (expression) {
    case "neutral":
      return (
        <g data-testid="mascot-expression-neutral" className="yanshi-mascot__expression">
          <path d="M62 111 Q72 119 82 111" />
          <path d="M118 111 Q128 119 138 111" />
          <path className="yanshi-mascot__mouth" d="M93 137 Q100 142 107 137" />
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
          <path d="M61 108 Q72 104 83 110" />
          <path d="M117 112 Q128 108 139 110" />
          <path className="yanshi-mascot__mouth" d="M94 139 L106 139" />
          <circle className="yanshi-mascot__thought-dot" cx="151" cy="87" r="4" />
          <circle className="yanshi-mascot__thought-dot" cx="163" cy="74" r="2.8" />
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
        <path d="M100 25 C57 25 34 55 34 94 C34 120 40 144 34 162 L50 154 L56 172 L70 158 L82 174 L100 164 L118 174 L130 158 L144 172 L150 154 L166 162 C160 144 166 120 166 94 C166 55 143 25 100 25 Z" />
      </g>

      <g data-testid="mascot-layer-body" className="yanshi-mascot__layer yanshi-mascot__body">
        <path d="M100 150 C124 150 138 166 141 197 L144 219 C145 230 134 235 100 235 C66 235 55 230 56 219 L59 197 C62 166 76 150 100 150 Z" />
        <path
          className="yanshi-mascot__sash"
          d="M70 161 C86 174 114 174 130 161 L134 176 C116 191 84 191 66 176 Z"
          fill="var(--ym-accent)"
          stroke="var(--ym-outline)"
        />
        <path className="yanshi-mascot__joint" d="M80 193 C77 199 77 204 80 210" />
        <path className="yanshi-mascot__joint" d="M120 193 C123 199 123 204 120 210" />
        <ellipse className="yanshi-mascot__hand" cx="60" cy="196" rx="9" ry="11" />
        <ellipse className="yanshi-mascot__hand" cx="140" cy="196" rx="9" ry="11" />
        <rect className="yanshi-mascot__boot" x="73" y="225" width="24" height="11" rx="5.5" />
        <rect className="yanshi-mascot__boot" x="103" y="225" width="24" height="11" rx="5.5" />
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
        <path d="M39 99 C38 57 65 35 100 35 C135 35 162 57 161 99 L149 82 L143 106 L130 76 L121 105 L106 67 L98 109 L83 72 L71 103 L59 78 L48 104 Z" />
        <path className="yanshi-mascot__hair-shine" d="M62 51 C76 42 92 39 106 39 L99 54 L78 58 Z" />
        <path className="yanshi-mascot__hair-glint" d="M125 52 C134 62 139 72 139 83 L128 73 Z" />
      </g>

      <g data-testid="mascot-layer-seal-fins" className="yanshi-mascot__layer yanshi-mascot__seal-fins">
        <path d="M55 55 L28 25 L22 50 L42 61 L35 72 L60 75 Z" />
        <path className="yanshi-mascot__fin-panel" d="M45 55 L32 37 L29 49 L43 59 Z" />
        <circle className="yanshi-mascot__seal-dot" cx="35" cy="49" r="3.8" />
        <path d="M145 55 L172 25 L178 50 L158 61 L165 72 L140 75 Z" />
        <path className="yanshi-mascot__fin-panel" d="M155 55 L168 37 L171 49 L157 59 Z" />
        <circle className="yanshi-mascot__seal-dot" cx="165" cy="49" r="3.8" />
      </g>

      <g data-testid="mascot-layer-seal-badge" className="yanshi-mascot__layer yanshi-mascot__seal-badge">
        <circle cx="136" cy="66" r="8" />
        <path d="M136 60 L136 72 M130 66 L142 66" />
      </g>

      <g data-testid="mascot-layer-prop-slot" className="yanshi-mascot__layer yanshi-mascot__prop-slot">
        <rect x="158" y="166" width="24" height="30" rx="6" />
        <path d="M164 177 L176 177 M164 186 L172 186" />
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
