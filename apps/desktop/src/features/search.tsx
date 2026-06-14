import type { AutomationSummary } from "@yanshi/shared";
import { Archive, Clock, FileSearch, Play, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { runtimeApi } from "../api/client";
import { Modal } from "../components/modal";
import { useT } from "../i18n";
import type { TKey } from "../i18n/en";
import { ProjectGlyph } from "../lib/shared";
import type { View } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

type Filter = "all" | "projects" | "runs" | "artifacts" | "packs" | "automations";
const FILTERS: Array<{ id: Filter; key: TKey }> = [
  { id: "all", key: "search.all" },
  { id: "projects", key: "search.projects" },
  { id: "runs", key: "search.runs" },
  { id: "artifacts", key: "search.artifacts" },
  { id: "packs", key: "search.workshop" },
  { id: "automations", key: "search.automations" },
];

export function SearchModal({ onClose, onNavigate, onNewTask, onOpenWorkshop }: { onClose: () => void; onNavigate: (view: View) => void; onNewTask: () => void; onOpenWorkshop: () => void }) {
  const { t } = useT();
  const { projects, runs, workshopPacks, events, setActiveProject, setActiveRun } = useRuntimeStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const term = query.trim().toLowerCase();

  useEffect(() => {
    runtimeApi.automations().then(setAutomations).catch(() => setAutomations([]));
  }, []);

  const match = (value: string | null | undefined) => !term || (value ?? "").toLowerCase().includes(term);
  const show = (f: Filter) => filter === "all" || filter === f;

  const artifactEvents = useMemo(() => events.filter((entry) => entry.event.type === "artifact.created"), [events]);
  const projectHits = show("projects") ? projects.filter((p) => match(p.name) || match(p.description)) : [];
  const runHits = show("runs") ? runs.filter((r) => match(r.task)) : [];
  const artifactHits = show("artifacts")
    ? artifactEvents.filter((e) => match(String(e.event.payload.title ?? "")) || match(String(e.event.payload.summary ?? "")))
    : [];
  const packHits = show("packs") ? workshopPacks.filter((p) => match(p.name)) : [];
  const automationHits = show("automations") ? automations.filter((a) => match(a.name) || match(a.task)) : [];
  const total = projectHits.length + runHits.length + artifactHits.length + packHits.length + automationHits.length;

  return (
    <Modal onClose={onClose} size="lg" className="search-modal">
        <div className="search-modal-head">
          <Search size={18} />
          <input data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} />
          <button className="icon-button ghost" aria-label={t("common.close")} title={t("search.close")} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="search-filters">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => setFilter(f.id)}>
              {t(f.key)}
            </button>
          ))}
        </div>
        <div className="search-results">
          <button className="search-row primary" onClick={() => { onNewTask(); onClose(); }}>
            <SquarePen size={16} /> {t("search.newTask")}
          </button>
          {term && total === 0 && <p className="transcript-empty">{t("search.noResults")}</p>}
          {projectHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">{t("search.projects")}</div>
              {projectHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { setActiveProject(p.id); onNavigate("project"); onClose(); }}>
                  <ProjectGlyph project={p} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {runHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">{t("search.runs")}</div>
              {runHits.slice(0, 20).map((r) => (
                <button key={r.id} className="search-row" onClick={() => { setActiveRun(r.id); onNavigate("runs"); onClose(); }}>
                  <Play size={15} /> {r.task}
                </button>
              ))}
            </div>
          )}
          {artifactHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">{t("search.artifacts")}</div>
              {artifactHits.slice(0, 20).map(({ seq, event }) => (
                <button key={seq} className="search-row" onClick={() => { onNavigate("runs"); onClose(); }}>
                  <FileSearch size={15} /> {String(event.payload.title ?? "Artifact")}
                </button>
              ))}
            </div>
          )}
          {packHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">{t("search.workshop")}</div>
              {packHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { onClose(); onOpenWorkshop(); }}>
                  <Archive size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {automationHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">{t("search.automations")}</div>
              {automationHits.map((a) => (
                <button key={a.id} className="search-row" onClick={() => { if (a.projectId) setActiveProject(a.projectId); onNavigate(a.projectId ? "project" : "projects"); onClose(); }}>
                  <Clock size={15} /> {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}
