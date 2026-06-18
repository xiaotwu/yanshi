import { Archive, Download, Trash2 } from "lucide-react";
import { useState } from "react";

import { runtimeApi } from "../api/client";
import { useContextMenu } from "../components/context-menu";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { safeOpenExternal } from "../lib/external";
import { useRuntimeStore } from "../stores/runtimeStore";

export function WorkshopInstalled() {
  const { t } = useT();
  const [result, setResult] = useState<string>("");
  const { workshopPacks, importWorkshopPack, loading } = useRuntimeStore();
  const { openContextMenu, contextMenu } = useContextMenu();
  const importPack = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importWorkshopPack(file);
      setResult(`Imported ${file.name}.`);
    } catch {
      // The store already raised a coded error toast; just don't claim success.
      setResult(`Could not import ${file.name}.`);
    }
  };
  const packMenu = () => [
    { id: "export", label: t("workshop.exportPack"), icon: Download, onSelect: () => void runtimeApi.exportPackUrl().then(safeOpenExternal) },
    "divider" as const,
    {
      id: "remove",
      label: t("common.remove"),
      icon: Trash2,
      danger: true,
      disabled: true,
      disabledReason: t("menu.notSupported"),
      onSelect: () => undefined,
    },
  ];
  return (
    <>
      <label className="drop-zone">
        <Archive size={22} />
        <span>{loading ? t("workshop.importing") : t("workshop.importPack")}</span>
        <input type="file" accept=".zip" onChange={(event) => void importPack(event.target.files?.[0])} />
      </label>
      {result && <p className="muted">{result}</p>}
      <div className="event-feed">
        {workshopPacks.length === 0 ? (
          <div className="empty-rich">
            <span className="empty-icon"><Archive size={20} /></span>
            <p>{t("workshop.noPacks")}</p>
          </div>
        ) : (
          workshopPacks.map((pack) => (
            <article key={pack.id} className="workshop-pack-row" onContextMenu={(event) => openContextMenu(event, packMenu())}>
              <Archive size={18} />
              <div>
                <strong>
                  {pack.name} {pack.version}
                </strong>
                <span>{pack.securityStatus}</span>
              </div>
              {/* Installed-only: packs ship as agent/office presets applied at import. There's no
                  runtime enable/disable yet, so we don't show a toggle that implies one. */}
              <span className="pack-status muted">{t("workshop.installed")}</span>
            </article>
          ))
        )}
      </div>
      {contextMenu}
    </>
  );
}

export function WorkshopExport() {
  const { t } = useT();
  const [status, setStatus] = useState<string | null>(null);
  const download = async () => {
    setStatus(t("workshop.exporting"));
    try {
      const response = await fetch(await runtimeApi.exportPackUrl());
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "yanshi-team.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Exported yanshi-team.zip");
    } catch (error) {
      reportError("YANSHI_WORKSHOP_001", error);
      setStatus(null);
    }
  };
  return (
    <div className="content-stack" style={{ padding: 0 }}>
      <p className="muted">{t("workshop.exportDesc")}</p>
      <div className="settings-actions">
        <button onClick={() => void download()}>{t("workshop.exportPack")}</button>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
