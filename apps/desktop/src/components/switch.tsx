/**
 * Toggle switch for on/off state (replaces checkboxes app-wide). Keyboard operable
 * (native button: Space/Enter), `role="switch"` + `aria-checked` for screen readers,
 * focus ring + sliding animation in CSS.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={checked ? "switch on" : "switch"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}
