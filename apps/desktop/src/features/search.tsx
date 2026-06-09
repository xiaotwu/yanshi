import type { AutomationSummary } from "@yanshi/shared";
import { Archive, Boxes, Clock, FileSearch, Play, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { runtimeApi } from "../api/client";
import type { View } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

type Filter = "all" | "projects" | "runs" | "artifacts" | "packs" | "automations";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "projects", label: "Projects" },
  { id: "runs", label: "Runs" },
  { id: "artifacts", label: "Artifacts" },
  { id: "packs", label: "Workshop" },
  { id: "automations", label: "Automations" },
];

export function SearchModal({ onClose, onNavigate, onNewTask }: { onClose: () => void; onNavigate: (view: View) => void; onNewTask: () => void }) {
  const { projects, runs, workshopPacks, events, setActiveProject, setActiveRun } = useRuntimeStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const term = query.trim().toLowerCase();

  useEffect(() => {
    runtimeApi.automations().then(setAutomations).catch(() => setAutomations([]));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="search-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-modal-head">
          <Search size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" />
          <button className="icon-button ghost" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="search-filters">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="search-results">
          <button className="search-row primary" onClick={() => { onNewTask(); onClose(); }}>
            <SquarePen size={16} /> New Task
          </button>
          {term && total === 0 && <p className="transcript-empty">No results.</p>}
          {projectHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Projects</div>
              {projectHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { setActiveProject(p.id); onNavigate("projects"); onClose(); }}>
                  <Boxes size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {runHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Runs</div>
              {runHits.slice(0, 20).map((r) => (
                <button key={r.id} className="search-row" onClick={() => { setActiveRun(r.id); onNavigate("runs"); onClose(); }}>
                  <Play size={15} /> {r.task}
                </button>
              ))}
            </div>
          )}
          {artifactHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Artifacts</div>
              {artifactHits.slice(0, 20).map(({ seq, event }) => (
                <button key={seq} className="search-row" onClick={() => { onNavigate("runs"); onClose(); }}>
                  <FileSearch size={15} /> {String(event.payload.title ?? "Artifact")}
                </button>
              ))}
            </div>
          )}
          {packHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Workshop</div>
              {packHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { onNavigate("workshop"); onClose(); }}>
                  <Archive size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {automationHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Automations</div>
              {automationHits.map((a) => (
                <button key={a.id} className="search-row" onClick={() => { if (a.projectId) setActiveProject(a.projectId); onNavigate("projects"); onClose(); }}>
                  <Clock size={15} /> {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
