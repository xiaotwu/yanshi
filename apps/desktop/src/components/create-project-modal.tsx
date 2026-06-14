import { Check } from "lucide-react";
import { useState } from "react";

import { useT } from "../i18n";
import { useRuntimeStore } from "../stores/runtimeStore";
import { Modal, ModalHeader } from "./modal";

const EMOJI_PRESETS = ["📁", "🧪", "✈️", "📊", "🎨", "💻", "📚", "🚀", "🧠", "🛠️", "📝", "🌐"];
// White is the default icon background; the accent + a calm palette follow.
export const COLOR_PRESETS = ["#ffffff", "#2fc279", "#5f7f9a", "#b08a5e", "#4f9a5b", "#d7b24a", "#c0413f", "#7c6cc4"];
type ContextMode = "default" | "project_only";

/**
 * New Project — centered modal with inline pickers (no fragile hover popovers):
 * emoji/icon + custom input, icon background color (white default + custom color), name,
 * context mode. The same model feeds the sidebar, project header, Add-to-Project menu and search.
 */
export function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (projectId: string) => void }) {
  const { t } = useT();
  const { createProject, projects, loading, error } = useRuntimeStore();
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [name, setName] = useState("");
  const [contextMode, setContextMode] = useState<ContextMode>("default");

  const trimmed = name.trim();
  const duplicate = projects.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase() && trimmed.length > 0);

  const create = async () => {
    if (!trimmed) return;
    const id = await createProject(trimmed, undefined, { icon, color, contextMode });
    if (id) {
      onCreated?.(id);
      onClose();
    }
    // On failure the store error stays visible inside the modal — no silent close.
  };

  return (
    <Modal onClose={onClose} size="sm" className="project-modal" labelledBy="new-project-title">
      <ModalHeader title={t("nav.newProject")} id="new-project-title" onClose={onClose} />
      <div className="modal-body project-create-body">
        <div className="project-modal-body">
          <span className="project-icon-button" style={{ background: color }} aria-hidden>
            {icon}
          </span>
          <input
            className="project-name-input"
            data-autofocus
            value={name}
            placeholder={t("project.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && trimmed && void create()}
          />
        </div>

        <div className="popover-label">{t("project.icon")}</div>
        <div className="emoji-grid">
          {EMOJI_PRESETS.map((preset) => (
            <button key={preset} className={icon === preset ? "emoji-cell on" : "emoji-cell"} onClick={() => setIcon(preset)}>
              {preset}
            </button>
          ))}
          <input
            className="emoji-input"
            value={icon}
            onChange={(event) => setIcon(event.target.value.slice(0, 2))}
            aria-label={t("project.icon")}
          />
        </div>

        <div className="popover-label">{t("project.color")}</div>
        <div className="color-row">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              className={color === preset ? "color-swatch on" : "color-swatch"}
              style={{ background: preset }}
              onClick={() => setColor(preset)}
              aria-label={preset}
            />
          ))}
          <label className="color-custom" title={t("project.customColor")}>
            <input type="color" value={color.startsWith("#") && color.length === 7 ? color : "#ffffff"} onChange={(event) => setColor(event.target.value)} aria-label={t("project.customColor")} />
          </label>
        </div>

        <div className="popover-label">{t("project.context")}</div>
        <div className="context-options-row">
          {(["default", "project_only"] as const).map((mode) => (
            <button key={mode} className={contextMode === mode ? "context-option on" : "context-option"} onClick={() => setContextMode(mode)}>
              <div>
                <strong>{t(mode === "default" ? "project.contextDefault" : "project.contextProjectOnly")}</strong>
                <small>{t(mode === "default" ? "project.contextDefaultDesc" : "project.contextProjectOnlyDesc")}</small>
              </div>
              {contextMode === mode && <Check size={15} />}
            </button>
          ))}
        </div>

        {duplicate && <p className="project-modal-hint">{t("project.duplicateName")}</p>}
        {error && <p className="inline-error">{error}</p>}
      </div>

      <div className="modal-actions">
        <button onClick={onClose}>{t("project.cancel")}</button>
        <button className="primary" disabled={!trimmed || loading} onClick={() => void create()}>
          {t("project.create")}
        </button>
      </div>
    </Modal>
  );
}
