import { Archive, Boxes, FileSearch, Play, Search } from "lucide-react";
import { useState } from "react";

import type { View } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export function SearchView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { projects, runs, workshopPacks, events, setActiveProject, setActiveRun } = useRuntimeStore();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const artifactEvents = events.filter((entry) => entry.event.type === "artifact.created");
  const projectHits = term ? projects.filter((p) => p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term)) : [];
  const runHits = term ? runs.filter((r) => r.task.toLowerCase().includes(term)) : [];
  const artifactHits = term
    ? artifactEvents.filter((entry) => String(entry.event.payload.title ?? "").toLowerCase().includes(term) || String(entry.event.payload.summary ?? "").toLowerCase().includes(term))
    : [];
  const packHits = term ? workshopPacks.filter((p) => p.name.toLowerCase().includes(term)) : [];
  const total = projectHits.length + runHits.length + artifactHits.length + packHits.length;

  return (
    <section className="content-stack">
      <div className="search-box">
        <Search size={18} />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, runs, artifacts…" />
      </div>
      {!term ? (
        <p className="transcript-empty">Type to search.</p>
      ) : total === 0 ? (
        <p className="transcript-empty">No results.</p>
      ) : (
        <div className="search-results">
          {projectHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Projects</div>
              {projectHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { setActiveProject(p.id); onNavigate("projects"); }}>
                  <Boxes size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {runHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Runs</div>
              {runHits.map((r) => (
                <button key={r.id} className="search-row" onClick={() => { setActiveRun(r.id); onNavigate("runs"); }}>
                  <Play size={15} /> {r.task}
                </button>
              ))}
            </div>
          )}
          {artifactHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Artifacts</div>
              {artifactHits.map(({ seq, event }) => (
                <button key={seq} className="search-row" onClick={() => onNavigate("artifacts")}>
                  <FileSearch size={15} /> {String(event.payload.title ?? "Artifact")}
                </button>
              ))}
            </div>
          )}
          {packHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Workshop</div>
              {packHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => onNavigate("workshop")}>
                  <Archive size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
