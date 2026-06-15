import type { AutomationSummary } from "@yanshi/shared";
import { Archive, Clock, FileSearch, Play, Search, SquarePen, X } from "lucide-react";
import { Fragment, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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

  // Flatten every result into one ordered list so ↑/↓/↵ can drive selection like a real palette.
  type Row = { key: string; group: string; icon: ReactNode; label: string; onSelect: () => void };
  const rows: Row[] = [
    { key: "new", group: "", icon: <SquarePen size={16} />, label: t("search.newTask"), onSelect: () => { onNewTask(); onClose(); } },
    ...projectHits.map((p) => ({
      key: `p-${p.id}`, group: t("search.projects"), icon: <ProjectGlyph project={p} />, label: p.name,
      onSelect: () => { setActiveProject(p.id); onNavigate("project"); onClose(); },
    })),
    ...runHits.slice(0, 20).map((r) => ({
      key: `r-${r.id}`, group: t("search.runs"), icon: <Play size={15} />, label: r.task,
      onSelect: () => { setActiveRun(r.id); onNavigate("runs"); onClose(); },
    })),
    ...artifactHits.slice(0, 20).map(({ seq, event }) => ({
      key: `a-${seq}`, group: t("search.artifacts"), icon: <FileSearch size={15} />, label: String(event.payload.title ?? "Artifact"),
      onSelect: () => { onNavigate("runs"); onClose(); },
    })),
    ...packHits.map((p) => ({
      key: `k-${p.id}`, group: t("search.workshop"), icon: <Archive size={15} />, label: p.name,
      onSelect: () => { onClose(); onOpenWorkshop(); },
    })),
    ...automationHits.map((a) => ({
      key: `m-${a.id}`, group: t("search.automations"), icon: <Clock size={15} />, label: a.name,
      onSelect: () => { if (a.projectId) setActiveProject(a.projectId); onNavigate(a.projectId ? "project" : "projects"); onClose(); },
    })),
  ];
  const total = rows.length - 1; // exclude the always-present "New Chat" action from the count

  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement>(null);
  // Reset selection to the top whenever the result set changes.
  useEffect(() => setActive(0), [query, filter]);
  useEffect(() => activeRef.current?.scrollIntoView({ block: "nearest" }), [active]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      rows[Math.min(active, rows.length - 1)]?.onSelect();
    }
  };

  return (
    <Modal onClose={onClose} size="lg" className="search-modal">
        <div className="search-modal-head">
          <Search size={18} />
          <input
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("search.placeholder")}
          />
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
          {term && total === 0 && <p className="transcript-empty">{t("search.noResults")}</p>}
          {rows.map((row, index) => {
            const showGroupLabel = row.group && (index === 0 || rows[index - 1].group !== row.group);
            return (
              <Fragment key={row.key}>
                {showGroupLabel && <div className="search-group-label">{row.group}</div>}
                <button
                  ref={index === active ? activeRef : undefined}
                  className={`search-row${index === 0 ? " primary" : ""}${index === active ? " active" : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={row.onSelect}
                >
                  {row.icon} {row.label}
                </button>
              </Fragment>
            );
          })}
        </div>
        <div className="search-foot">
          <span className="search-hints">
            <kbd>↑</kbd><kbd>↓</kbd> {t("search.hintNav")}
            <span className="search-hint-sep" />
            <kbd>↵</kbd> {t("search.hintOpen")}
            <span className="search-hint-sep" />
            <kbd>esc</kbd> {t("search.hintClose")}
          </span>
          {term && <span className="search-count">{t("search.count", { count: total })}</span>}
        </div>
    </Modal>
  );
}
