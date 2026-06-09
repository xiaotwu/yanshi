import { FileSearch, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { runtimeApi } from "../api/client";
import { canRevealFiles, revealPath } from "../api/desktop";
import { EmptyView, agentLabel } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export function ArtifactsView() {
  const events = useRuntimeStore((state) => state.events);
  const [artifacts, setArtifacts] = useState<import("@yanshi/shared").ArtifactSummary[] | null>(null);
  const artifactCount = events.filter((entry) => entry.event.type === "artifact.created").length;

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .artifacts()
      .then((items) => !cancelled && setArtifacts(items))
      .catch(() => !cancelled && setArtifacts([]));
    return () => {
      cancelled = true;
    };
    // Re-fetch when new artifacts stream in.
  }, [artifactCount]);

  if (!artifacts) return <EmptyView title="Artifacts" text="Loading…" />;
  if (artifacts.length === 0) return <EmptyView title="Artifacts" text="No artifacts yet." />;

  return (
    <section className="content-stack">
      <h2>Artifacts</h2>
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </section>
  );
}

export function ArtifactCard({ artifact }: { artifact: import("@yanshi/shared").ArtifactSummary }) {
  return (
    <article className="event-card artifact-card">
      <div className="artifact-head">
        <div>
          <span>{artifact.kind}</span>
          <strong>{artifact.title}</strong>
        </div>
        {canRevealFiles() && (
          <button className="ghost-button" title="Reveal in Finder" onClick={() => void revealPath(artifact.path)}>
            <FolderOpen size={15} /> Reveal
          </button>
        )}
      </div>
      <p>{artifact.summary}</p>
      <details className="msg-details">
        <summary>Details</summary>
        <dl className="runtime-details">
          <dt>Agent</dt>
          <dd>{agentLabel(artifact.agentId)}</dd>
          <dt>Created</dt>
          <dd>{new Date(artifact.createdAt).toLocaleString()}</dd>
          <dt>Path</dt>
          <dd>{artifact.path}</dd>
        </dl>
      </details>
    </article>
  );
}
