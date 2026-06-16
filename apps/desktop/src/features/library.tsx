import { CheckSquare, ChevronDown, ChevronRight, ClipboardCopy, FileText, FolderOpen, Globe, Package, Search, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ArtifactSummary, ProjectSummary, RunSummary, WorkspaceFile } from "@yanshi/shared";

import { runtimeApi } from "../api/client";
import { canRevealFiles, revealPath } from "../api/desktop";
import { useContextMenu } from "../components/context-menu";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { safeOpenExternal } from "../lib/external";
import { notify } from "../lib/notices";
import { type FileCategory, FileTypeIcon, fileCategory, outputFileName, projectIcon } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

type LibraryMode = "grouped" | "files";
type LibrarySort = "newest" | "oldest" | "name" | "size" | "type";

interface LibraryItem {
  key: string;
  name: string;
  /** Artifact title (e.g. "File scan") shown as secondary context when it differs from the name. */
  title?: string;
  path: string;
  kind: "artifact" | "file";
  type: string;
  size?: number | null;
  createdAt?: string;
  projectId?: string | null;
  runId?: string | null;
  summary?: string;
  /** Web source URL when the output came from the web (artifact metadata). */
  url?: string | null;
}

function artifactItem(artifact: ArtifactSummary): LibraryItem {
  // Show the real file name (from the artifact's path); the artifact title ("File scan") becomes
  // secondary context instead of masquerading as a file name.
  const url = typeof artifact.metadata.url === "string" ? artifact.metadata.url : null;
  return {
    key: `artifact-${artifact.id}`,
    name: outputFileName(artifact.path, artifact.title),
    title: artifact.title,
    path: artifact.path,
    kind: "artifact",
    type: artifact.kind,
    createdAt: artifact.createdAt,
    projectId: artifact.projectId,
    runId: artifact.runId,
    summary: artifact.summary,
    url,
  };
}

function fileItem(file: WorkspaceFile, projectId: string): LibraryItem {
  const dot = file.name.lastIndexOf(".");
  return {
    key: `file-${projectId}-${file.path}`,
    name: file.name,
    path: file.path,
    kind: "file",
    type: file.type === "directory" ? "folder" : dot > 0 ? file.name.slice(dot + 1) : "file",
    size: file.size,
    projectId,
  };
}

/** Leading visual for a library row: an inline image preview for image files, falling back to the
 *  file-type icon for everything else (and if the preview fails to load — too large, decode error,
 *  or unsupported type like HEIC in this webview). */
function LibraryThumb({ item }: { item: LibraryItem }) {
  const [failed, setFailed] = useState(false);
  const isImage = fileCategory(item.name, item.type) === "image";
  if (isImage && !failed) {
    return (
      <img
        className="library-thumb"
        src={runtimeApi.previewUrl(item.path, item.projectId)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return <FileTypeIcon name={item.name} type={item.type} size={15} />;
}

function sortItems(items: LibraryItem[], sort: LibrarySort): LibraryItem[] {
  const sorted = [...items];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.name.localeCompare(b.name));
    case "oldest":
      return sorted.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.name.localeCompare(b.name));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "size":
      return sorted.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    case "type":
      return sorted.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }
}

function formatSize(size: number | null | undefined): string {
  if (typeof size !== "number") return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Library — the user-facing home for files and artifacts across Projects and standalone tasks
 * (replaces the technical top-level Runs page). Organized Project → task; deletion is not offered
 * because the runtime has no artifact/file delete API (no fake actions).
 */
const COLLAPSED_KEY = "yanshi.library.collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function LibraryView({ onOpenTask }: { onOpenTask: (runId: string) => void }) {
  const { t } = useT();
  const { projects, runs } = useRuntimeStore();
  const ready = useRuntimeStore((state) => state.ready);
  const [mode, setMode] = useState<LibraryMode>("grouped");
  const [sort, setSort] = useState<LibrarySort>("newest");
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileCategory>("all");
  // Collapsed groups persist across sessions (local UI state, not runtime data).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Persistence is best-effort; the toggle still works for this session.
      }
      return next;
    });
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [filesByProject, setFilesByProject] = useState<Record<string, WorkspaceFile[]>>({});
  // Multi-select for bulk actions, keyed by item.key. Selection mode is implicit: the action bar
  // and per-row checkboxes appear once anything is selected.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadFailed, setLoadFailed] = useState(false);
  const { openContextMenu, contextMenu } = useContextMenu();

  const toggleSelect = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .artifacts()
      .then((result) => {
        if (cancelled) return;
        setArtifacts(result);
        setLoadFailed(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Distinguish "load failed" from "no files yet" so the empty state isn't misleading.
        setLoadFailed(true);
        reportError("YANSHI_FILE_002", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const project of projects) {
      runtimeApi
        .projectFiles(project.id)
        .then((result) => {
          if (cancelled) return;
          setFilesByProject((prev) => ({ ...prev, [project.id]: (result.structuredOutput.items ?? []).filter((f) => f.type === "file") }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const allItems = useMemo(() => {
    const items = [
      ...artifacts.map(artifactItem),
      ...Object.entries(filesByProject).flatMap(([projectId, files]) => files.map((file) => fileItem(file, projectId))),
    ];
    const query = filter.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!query || item.name.toLowerCase().includes(query)) &&
        (typeFilter === "all" || fileCategory(item.name, item.type) === typeFilter),
    );
  }, [artifacts, filesByProject, filter, typeFilter]);

  const itemActions = (item: LibraryItem) => {
    const run = item.runId ? runs.find((r) => r.id === item.runId) : null;
    return [
      {
        id: "reveal",
        label: t("library.reveal"),
        icon: FolderOpen,
        disabled: !canRevealFiles(),
        disabledReason: t("library.desktopOnly"),
        onSelect: () => void revealPath(item.path),
      },
      { id: "copy-path", label: t("library.copyPath"), icon: ClipboardCopy, onSelect: () => void navigator.clipboard.writeText(item.path) },
      ...(item.summary
        ? [{ id: "copy-summary", label: t("library.copySummary"), icon: ClipboardCopy, onSelect: () => void navigator.clipboard.writeText(item.summary ?? "") }]
        : []),
      ...(run ? [{ id: "open-task", label: t("library.showTask"), icon: FileText, onSelect: () => onOpenTask(run.id) }] : []),
    ];
  };

  const renderItem = (item: LibraryItem) => {
    const project = item.projectId ? projects.find((p) => p.id === item.projectId) : null;
    const run = item.runId ? runs.find((r) => r.id === item.runId) : null;
    const isSelected = selected.has(item.key);
    return (
      <div key={item.key} className={`library-row-wrap${isSelected ? " selected" : ""}${selected.size > 0 ? " selecting" : ""}`}>
        <button
          className="library-checkbox"
          onClick={() => toggleSelect(item.key)}
          aria-label={t("library.select")}
          aria-pressed={isSelected}
        >
          {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
        </button>
        <button
          className="library-row"
          // In selection mode a row click toggles selection; otherwise it opens the source chat (or
          // reveals the file in Finder), the original behavior.
          onClick={() => {
            if (selected.size > 0) {
              toggleSelect(item.key);
              return;
            }
            if (run) onOpenTask(run.id);
            else if (canRevealFiles()) void revealPath(item.path);
          }}
          onContextMenu={(event) => openContextMenu(event, itemActions(item))}
          title={item.path}
        >
          <LibraryThumb item={item} />
        <span className="library-name ellipsis">{item.name}</span>
        <span className="library-meta">
          {item.title && item.title !== item.name && <small className="ellipsis library-title">{item.title}</small>}
          {project && (
            <small className="ellipsis">
              {projectIcon(project)} {project.name}
            </small>
          )}
          {run && <small className="ellipsis library-task">{run.task}</small>}
          {item.url && (
            <span
              className="web-source"
              role="link"
              title={item.url}
              onClick={(event) => {
                event.stopPropagation();
                safeOpenExternal(item.url ?? "");
              }}
            >
              <Globe size={11} /> {t("library.webSource")}
            </span>
          )}
          <small className="library-type">{item.type}</small>
          {typeof item.size === "number" && <small>{formatSize(item.size)}</small>}
          {item.createdAt && <small>{item.createdAt.slice(0, 16).replace("T", " ")}</small>}
        </span>
        </button>
      </div>
    );
  };

  const groupedSections = useMemo(() => {
    const sections: Array<{ id: string; project: ProjectSummary | null; tasks: Array<{ run: RunSummary; items: LibraryItem[] }>; files: LibraryItem[] }> = [];
    const byRun = new Map<string, LibraryItem[]>();
    for (const item of allItems) {
      if (!item.runId) continue;
      const list = byRun.get(item.runId) ?? [];
      list.push(item);
      byRun.set(item.runId, list);
    }
    for (const project of projects) {
      const projectRuns = runs.filter((run) => run.projectId === project.id);
      const tasks = projectRuns
        .map((run) => ({ run, items: sortItems(byRun.get(run.id) ?? [], sort) }))
        .filter((entry) => entry.items.length > 0);
      const files = sortItems(allItems.filter((item) => item.kind === "file" && item.projectId === project.id), sort);
      if (tasks.length > 0 || files.length > 0) sections.push({ id: project.id, project, tasks, files });
    }
    const standaloneTasks = runs
      .filter((run) => !run.projectId)
      .map((run) => ({ run, items: sortItems(byRun.get(run.id) ?? [], sort) }))
      .filter((entry) => entry.items.length > 0);
    if (standaloneTasks.length > 0) sections.push({ id: "standalone", project: null, tasks: standaloneTasks, files: [] });
    return sections;
  }, [allItems, projects, runs, sort]);

  const flatItems = useMemo(() => sortItems(allItems, sort), [allItems, sort]);

  const selectedItems = useMemo(() => allItems.filter((item) => selected.has(item.key)), [allItems, selected]);
  const allVisibleSelected = flatItems.length > 0 && flatItems.every((item) => selected.has(item.key));
  const selectAllVisible = () => setSelected(new Set(flatItems.map((item) => item.key)));
  const copySelectedPaths = () => {
    if (selectedItems.length === 0) return;
    void navigator.clipboard.writeText(selectedItems.map((item) => item.path).join("\n"));
    notify(t("library.pathsCopied", { count: selectedItems.length }), "success");
    clearSelection();
  };

  return (
    <section className="library-view">
      <header className="view-header">
        <div>
          <h2>{t("nav.library")}</h2>
        </div>
        <div className="library-controls">
          <div className="library-filter">
            <Search size={14} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("library.filter")} />
          </div>
          <div className="group-toggle">
            {(["grouped", "files"] as LibraryMode[]).map((option) => (
              <button key={option} className={mode === option ? "active" : ""} onClick={() => setMode(option)}>
                {t(`library.view.${option}`)}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)} aria-label={t("library.sort")}>
            {(["newest", "oldest", "name", "size", "type"] as LibrarySort[]).map((option) => (
              <option key={option} value={option}>
                {t(`library.sort.${option}`)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="library-facets">
        {(["all", "image", "code", "data", "doc"] as const).map((cat) => (
          <button key={cat} className={typeFilter === cat ? "facet active" : "facet"} onClick={() => setTypeFilter(cat)}>
            {t(`library.type.${cat}`)}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="library-selection-bar">
          <span className="selection-count">{t("library.selected", { count: selected.size })}</span>
          <button className="link-button" onClick={copySelectedPaths}>
            <ClipboardCopy size={14} /> {t("library.copyPaths")}
          </button>
          {!allVisibleSelected && (
            <button className="link-button" onClick={selectAllVisible}>
              <CheckSquare size={14} /> {t("library.selectAll")}
            </button>
          )}
          <button className="link-button" onClick={clearSelection}>
            <X size={14} /> {t("library.clearSelection")}
          </button>
        </div>
      )}

      {loadFailed ? (
        <div className="empty-rich">
          <span className="empty-icon"><Package size={20} /></span>
          <p>{t("common.loadFailed")}</p>
        </div>
      ) : !ready ? (
        <div className="library-groups" aria-hidden>
          {[0, 1].map((group) => (
            <div key={group} className="library-group">
              <div className="skeleton skel-lib-group" style={{ width: "32%", height: 16 }} />
              {[78, 64, 70].map((width, item) => (
                <div key={item} className="skeleton skel-lib-item" style={{ width: `${width}%`, marginLeft: 18 }} />
              ))}
            </div>
          ))}
        </div>
      ) : mode === "grouped" ? (
        groupedSections.length === 0 ? (
          <div className="empty-rich"><span className="empty-icon"><Package size={20} /></span><p>{t("library.empty")}</p></div>
        ) : (
          <div className="library-groups">
            {groupedSections.map((section) => {
              const sectionCollapsed = Boolean(collapsed[section.id]);
              return (
                <div key={section.id} className="library-group">
                  <button
                    className="library-group-head as-toggle"
                    onClick={() => toggleCollapsed(section.id)}
                    aria-expanded={!sectionCollapsed}
                  >
                    {sectionCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {section.project ? (
                      <>
                        <span className="proj-emoji">{projectIcon(section.project)}</span> {section.project.name}
                      </>
                    ) : (
                      t("library.standalone")
                    )}
                  </button>
                  {!sectionCollapsed && (
                    <>
                      {section.tasks.map(({ run, items }) => {
                        const taskKey = `${section.id}:${run.id}`;
                        const taskCollapsed = Boolean(collapsed[taskKey]);
                        return (
                          <div key={run.id} className="library-task-group">
                            <div className="library-task-head-row">
                              <button
                                className="icon-button ghost"
                                onClick={() => toggleCollapsed(taskKey)}
                                aria-expanded={!taskCollapsed}
                                aria-label={run.task}
                              >
                                {taskCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                              </button>
                              <button className="library-task-head ellipsis" onClick={() => onOpenTask(run.id)} title={run.task}>
                                {run.task}
                              </button>
                            </div>
                            {!taskCollapsed && items.map(renderItem)}
                          </div>
                        );
                      })}
                      {section.files.length > 0 && (
                        <div className="library-task-group">
                          <div className="library-task-head-row">
                            <button
                              className="icon-button ghost"
                              onClick={() => toggleCollapsed(`${section.id}:files`)}
                              aria-expanded={!collapsed[`${section.id}:files`]}
                              aria-label={t("library.workspaceFiles")}
                            >
                              {collapsed[`${section.id}:files`] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <div className="library-task-head muted">{t("library.workspaceFiles")}</div>
                          </div>
                          {!collapsed[`${section.id}:files`] && section.files.map(renderItem)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : flatItems.length === 0 ? (
        <div className="empty-rich"><span className="empty-icon"><Package size={20} /></span><p>{t("library.empty")}</p></div>
      ) : (
        <div className="library-flat">{flatItems.map(renderItem)}</div>
      )}
      {contextMenu}
    </section>
  );
}
