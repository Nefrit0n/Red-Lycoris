import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Star, EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects, usePatchProjectPinned, useCreateProject, useDeleteProject, useUpdateProject } from "@/api/projects";
import { apiGet } from "@/api/client";
import { useCurrentUser } from "@/api/auth";
import {
  parseProjectsUrlParams,
  serializeProjectsUrlParams,
  type ProjectsSortMode,
  type ProjectsViewMode,
} from "@/lib/projects-query";
import { readStorage, writeStorage } from "@/lib/local-storage";
import { groupPinnedFirst, hasProjectsFilters } from "@/lib/projects-list-utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { Project } from "@/types";
import { CreateProjectWizardDialog } from "@/components/projects/CreateProjectWizardDialog";

const VIEW_MODE_KEY = "projects:view-mode";
const TREND_TTL_MS = 5 * 60 * 1000;
const QUICK_PEEK_TTL_MS = 30 * 1000;

interface TrendPoint {
  date: string;
  count: number;
}

interface QuickPeekData {
  top_findings: Array<{ id: string; title: string; severity: number; status: number }>;
  events: Array<{ id: string; action: string; method: string; path: string; created_at: string }>;
  status_stats: { new: number; triaged: number; fixed: number; wontfix: number };
}

function ownerInitials(project: Project): string {
  const raw = project.owner.display_name || project.owner.email || "?";
  const parts = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarColorSeed(ownerId: string): string {
  const palette = [
    "bg-blue-500/20 text-blue-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-violet-500/20 text-violet-300",
    "bg-amber-500/20 text-amber-300",
    "bg-cyan-500/20 text-cyan-300",
    "bg-pink-500/20 text-pink-300",
  ];
  let hash = 0;
  for (let i = 0; i < ownerId.length; i += 1) {
    hash = (hash * 31 + ownerId.charCodeAt(i)) % palette.length;
  }
  return palette[Math.abs(hash) % palette.length];
}

function severityTextColor(value: number, severity: "critical" | "high" | "medium" | "low" | "info"): string {
  if (value === 0) return "text-zinc-600";
  if (severity === "critical") return "text-red-400";
  if (severity === "high") return "text-orange-400";
  if (severity === "medium") return "text-amber-400";
  if (severity === "low") return "text-sky-400";
  return "text-zinc-300";
}

function scannerClasses(state: Project["scanners"]["sast"]): string {
  if (state === "ok") return "bg-emerald-500/20 text-emerald-300";
  if (state === "missing") return "bg-red-500/20 text-red-300";
  return "bg-zinc-800 text-zinc-500";
}

function buildSparkline(points: TrendPoint[], width = 58, height = 24): string {
  if (points.length === 0) {
    return `M 2 ${height / 2} L ${width - 2} ${height / 2}`;
  }
  const values = points.map((p) => p.count);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = points.length > 1 ? (width - 4) / (points.length - 1) : 0;

  return points
    .map((p, index) => {
      const x = 2 + step * index;
      const y = height - 2 - ((p.count - min) / range) * (height - 4);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function ProjectsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(
    () => parseProjectsUrlParams(searchParams),
    [searchParams],
  );

  const [searchInput, setSearchInput] = useState(urlState.q ?? "");
  const [pendingUrlPatch, setPendingUrlPatch] = useState<{
    patch: Partial<typeof urlState>;
    replace?: boolean;
  } | null>(null);

  useEffect(() => {
    setSearchInput(urlState.q ?? "");
  }, [urlState.q]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if ((urlState.q ?? "") === searchInput.trim()) return;
      setPendingUrlPatch({
        patch: {
          q: searchInput.trim() || undefined,
          cursor: undefined,
        },
        replace: true,
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput, urlState.q]);

  const projectsQuery = useMemo(
    () => ({
      limit: 200,
      cursor: urlState.cursor,
      view: urlState.view,
      status: urlState.status,
      team: urlState.team,
      sla: urlState.sla,
      tag: urlState.tag,
      q: urlState.q,
      sort: urlState.sort,
      owner: urlState.owner,
    }),
    [
      urlState.cursor,
      urlState.owner,
      urlState.q,
      urlState.sla,
      urlState.sort,
      urlState.status,
      urlState.tag,
      urlState.team,
      urlState.view,
    ],
  );

  const { data, isLoading } = useProjects(projectsQuery);
  const { data: currentUser } = useCurrentUser();
  const projects = useMemo(() => data?.data ?? [], [data]);

  useEffect(() => {
    if (urlState.view) {
      writeStorage(VIEW_MODE_KEY, urlState.view);
      return;
    }
    if (projects.length === 0) return;

    const saved = readStorage<ProjectsViewMode | null>(VIEW_MODE_KEY, null);
    const fallback: ProjectsViewMode = projects.length > 12 ? "list" : "grid";
    const view: ProjectsViewMode = saved === "grid" || saved === "list" ? saved : fallback;

    setPendingUrlPatch({
      patch: {
        view,
      },
      replace: true,
    });
  }, [projects.length, urlState.view]);

  useEffect(() => {
    if (!pendingUrlPatch) return;
    const next = serializeProjectsUrlParams({
      ...urlState,
      ...pendingUrlPatch.patch,
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: Boolean(pendingUrlPatch.replace) });
    }
    setPendingUrlPatch(null);
  }, [pendingUrlPatch, searchParams, setSearchParams, urlState]);

  const [showCreate, setShowCreate] = useState(false);
  const patchPinned = usePatchProjectPinned();
  const updateProject = useUpdateProject();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [trendCache, setTrendCache] = useState<Record<string, { points: TrendPoint[]; fetchedAt: number }>>({});
  const [loadingTrendIds, setLoadingTrendIds] = useState<Set<string>>(new Set());
  const [queuedTrendIds, setQueuedTrendIds] = useState<string[]>([]);
  const [quickPeekCache, setQuickPeekCache] = useState<Record<string, { data: QuickPeekData; fetchedAt: number }>>({});
  const [loadingQuickPeekIds, setLoadingQuickPeekIds] = useState<Set<string>>(new Set());
  const [activeQuickPeekId, setActiveQuickPeekId] = useState<string | null>(null);
  const trendTargetsRef = useRef<Map<string, Element>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.getAttribute("data-project-id"))
          .filter((id): id is string => Boolean(id));
        if (visible.length === 0) return;
        setQueuedTrendIds((prev) => Array.from(new Set([...prev, ...visible])));
      },
      { rootMargin: "150px 0px 150px 0px", threshold: 0.1 },
    );
    observerRef.current = observer;
    return () => observer.disconnect();
  }, []);

  const registerTrendTarget = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      const observer = observerRef.current;
      const prevNode = trendTargetsRef.current.get(id);
      if (observer && prevNode) observer.unobserve(prevNode);
      if (node) {
        trendTargetsRef.current.set(id, node);
        if (observer) observer.observe(node);
      } else {
        trendTargetsRef.current.delete(id);
      }
    },
    [],
  );

  useEffect(() => {
    if (queuedTrendIds.length === 0) return;
    const now = Date.now();
    const idsToLoad = queuedTrendIds.filter((id) => {
      if (loadingTrendIds.has(id)) return false;
      const cached = trendCache[id];
      return !cached || now - cached.fetchedAt > TREND_TTL_MS;
    });

    if (idsToLoad.length === 0) {
      setQueuedTrendIds([]);
      return;
    }

    setLoadingTrendIds((prev) => new Set([...Array.from(prev), ...idsToLoad]));
    setQueuedTrendIds((prev) => prev.filter((id) => !idsToLoad.includes(id)));

    Promise.all(
      idsToLoad.map(async (id) => {
        try {
          const response = await apiGet<{ data: TrendPoint[] }>(`/api/v1/projects/${id}/trend`, { days: "30" });
          return { id, points: response.data ?? [] };
        } catch {
          return { id, points: [] as TrendPoint[] };
        }
      }),
    ).then((results) => {
      const fetchedAt = Date.now();
      setTrendCache((prev) => {
        const next = { ...prev };
        results.forEach((item) => {
          next[item.id] = { points: item.points, fetchedAt };
        });
        return next;
      });
      setLoadingTrendIds((prev) => {
        const next = new Set(prev);
        idsToLoad.forEach((id) => next.delete(id));
        return next;
      });
    });
  }, [loadingTrendIds, queuedTrendIds, trendCache]);

  const loadQuickPeek = useCallback(
    async (projectId: string) => {
      const cached = quickPeekCache[projectId];
      if (cached && Date.now() - cached.fetchedAt < QUICK_PEEK_TTL_MS) return;
      if (loadingQuickPeekIds.has(projectId)) return;

      setLoadingQuickPeekIds((prev) => new Set([...Array.from(prev), projectId]));
      try {
        const response = await apiGet<{ data: QuickPeekData }>(`/api/v1/projects/${projectId}/quick-peek`);
        setQuickPeekCache((prev) => ({
          ...prev,
          [projectId]: {
            data: response.data ?? { top_findings: [], events: [], status_stats: { new: 0, triaged: 0, fixed: 0, wontfix: 0 } },
            fetchedAt: Date.now(),
          },
        }));
      } finally {
        setLoadingQuickPeekIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    },
    [loadingQuickPeekIds, quickPeekCache],
  );

  const openQuickPeek = useCallback(
    (projectId: string) => {
      setActiveQuickPeekId((prev) => (prev === projectId ? null : projectId));
      void loadQuickPeek(projectId);
    },
    [loadQuickPeek],
  );

  const handleSortChange = useCallback(
    (value: ProjectsSortMode) => {
      setPendingUrlPatch({
        patch: {
          sort: value,
          cursor: undefined,
        },
      });
    },
    [],
  );

  const handleViewChange = useCallback(
    (nextView: ProjectsViewMode) => {
      writeStorage(VIEW_MODE_KEY, nextView);
      setPendingUrlPatch({
        patch: {
          view: nextView,
        },
      });
    },
    [],
  );

  const handlePinnedToggle = useCallback(
    (project: Project) => {
      patchPinned.mutate({
        id: project.id,
        pinned: !project.pinned,
      });
    },
    [patchPinned],
  );

  const canDeleteProject = useCallback(
    (project: Project) =>
      Boolean(currentUser) &&
      (currentUser?.global_role === 1 || currentUser?.id === project.owner.id),
    [currentUser],
  );

  const handleRenameProject = useCallback(
    (project: Project) => {
      const nextName = window.prompt("Новое имя проекта", project.name)?.trim();
      if (!nextName || nextName === project.name) return;
      updateProject.mutate({
        id: project.id,
        body: {
          ...project,
          name: nextName,
        },
      });
    },
    [updateProject],
  );

  const handleDuplicateProject = useCallback(
    (project: Project) => {
      const fallbackName = `${project.name} (copy)`;
      const nextName = window.prompt("Название копии проекта", fallbackName)?.trim();
      if (!nextName) return;
      createProject.mutate(
        {
          name: nextName,
          description: project.description ?? "",
          icon_color: project.icon_color,
          repo_url: project.repo_url ?? "",
          repo_provider: project.repo_provider ?? "other",
          tags: project.tags,
          status: "active",
          visibility: "workspace",
          owner_id: project.owner.id,
        },
        {
          onSuccess: (created) => {
            if (created.data?.id) {
              navigate(`/projects/${created.data.id}`);
            }
          },
        },
      );
    },
    [createProject, navigate],
  );

  const handleArchiveProject = useCallback(
    (project: Project) => {
      if (project.status === "archived") return;
      updateProject.mutate({
        id: project.id,
        body: {
          ...project,
          status: "archived",
        },
      });
    },
    [updateProject],
  );

  const handleDeleteProject = useCallback(
    (project: Project) => {
      if (!canDeleteProject(project)) return;
      const confirmed = window.confirm(
        `Удалить проект «${project.name}»?\nЭто действие безвозвратно удалит проект и все его уязвимости.`,
      );
      if (!confirmed) return;
      deleteProject.mutate(project.id);
    },
    [canDeleteProject, deleteProject],
  );

  const applyUrlState = useCallback(
    (nextState: Partial<typeof urlState>) => {
      setPendingUrlPatch({
        patch: {
          ...nextState,
          cursor: undefined,
        },
      });
    },
    [],
  );

  const toggleMultiFilter = useCallback(
    (key: "status" | "tag", value: string) => {
      const current = urlState[key];
      const nextValues = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      applyUrlState({ [key]: nextValues } as Partial<typeof urlState>);
    },
    [applyUrlState, urlState],
  );

  const facets = useMemo(() => {
    const byStatus = {
      active: 0,
      paused: 0,
      archived: 0,
    };
    const byTeam = new Map<string, number>();
    const byTag = new Map<string, number>();
    let slaBreached = 0;
    let slaOnTime = 0;
    let noDast = 0;
    let noSca = 0;
    let noSecrets = 0;
    let fullCoverage = 0;

    projects.forEach((project) => {
      byStatus[project.status] += 1;
      if (project.team?.name) {
        byTeam.set(project.team.name, (byTeam.get(project.team.name) ?? 0) + 1);
      }
      project.tags.forEach((tag) => {
        byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      });
      if (project.sla_breached_count > 0) slaBreached += 1;
      else slaOnTime += 1;

      const hasDast = project.scanners.dast === "ok";
      const hasSca = project.scanners.sca === "ok";
      const hasSecrets = project.scanners.secrets === "ok";
      if (!hasDast) noDast += 1;
      if (!hasSca) noSca += 1;
      if (!hasSecrets) noSecrets += 1;
      if (hasDast && hasSca && hasSecrets) fullCoverage += 1;
    });

    return {
      byStatus,
      teams: Array.from(byTeam.entries()).sort((a, b) => b[1] - a[1]),
      tags: Array.from(byTag.entries()).sort((a, b) => b[1] - a[1]),
      slaBreached,
      slaOnTime,
      noDast,
      noSca,
      noSecrets,
      fullCoverage,
    };
  }, [projects]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    urlState.status.forEach((status) =>
      chips.push({
        key: `status:${status}`,
        label: `Статус: ${status}`,
        onRemove: () => toggleMultiFilter("status", status),
      }),
    );
    urlState.tag.forEach((tag) =>
      chips.push({
        key: `tag:${tag}`,
        label: `Тег: ${tag}`,
        onRemove: () => toggleMultiFilter("tag", tag),
      }),
    );
    if (urlState.team) {
      chips.push({
        key: "team",
        label: `Команда: ${urlState.team}`,
        onRemove: () => applyUrlState({ team: undefined }),
      });
    }
    if (urlState.sla) {
      chips.push({
        key: "sla",
        label: `SLA: ${urlState.sla}`,
        onRemove: () => applyUrlState({ sla: undefined }),
      });
    }
    if (urlState.owner) {
      chips.push({
        key: "owner",
        label: `Owner: ${urlState.owner}`,
        onRemove: () => applyUrlState({ owner: undefined }),
      });
    }
    return chips;
  }, [applyUrlState, toggleMultiFilter, urlState.owner, urlState.sla, urlState.status, urlState.tag, urlState.team]);

  const viewMode: ProjectsViewMode = urlState.view ?? (projects.length > 12 ? "list" : "grid");
  const hasActiveFilters = hasProjectsFilters(urlState);
  const sortedProjects = useMemo(() => groupPinnedFirst(projects), [projects]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 bg-zinc-800/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">{projects.length}</span>{" "}
          проектов
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-0.5 text-sm">
            <button
              type="button"
              className={`rounded px-2 py-1 ${
                viewMode === "grid" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"
              }`}
              onClick={() => handleViewChange("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${
                viewMode === "list" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"
              }`}
              onClick={() => handleViewChange("list")}
            >
              List
            </button>
          </div>
          <Button onClick={() => setShowCreate(true)} variant="outline" size="sm">
            <Plus className="size-4" />
            Новый проект
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по имени, тегу, репозиторию..."
          className="h-9 max-w-md border-zinc-700 bg-zinc-900 text-zinc-200"
        />
        <Select
          value={urlState.sort}
          onValueChange={(value) => handleSortChange(value as ProjectsSortMode)}
        >
          <SelectTrigger className="h-9 w-[210px] border-zinc-700 bg-zinc-900 text-zinc-200">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="critical-desc">Critical ↓</SelectItem>
            <SelectItem value="name">Имя</SelectItem>
            <SelectItem value="scan-date">Дата скана</SelectItem>
            <SelectItem value="trend">Тренд</SelectItem>
            <SelectItem value="created-at">Дата создания</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {activeFilterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          >
            {chip.label}
            <span className="text-zinc-500">×</span>
          </button>
        ))}
        {activeFilterChips.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-zinc-400"
            onClick={() =>
              applyUrlState({
                status: [],
                tag: [],
                team: undefined,
                sla: undefined,
                owner: undefined,
              })
            }
          >
            Сбросить фильтры
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[170px_1fr]">
        <aside className="space-y-4 md:sticky md:top-4 md:h-fit">
          <section>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Статус</p>
            <div className="space-y-1">
              {[
                ["active", "Активные", facets.byStatus.active],
                ["paused", "На паузе", facets.byStatus.paused],
                ["archived", "В архиве", facets.byStatus.archived],
              ].map(([value, label, count]) => {
                const selected = urlState.status.includes(value as string);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleMultiFilter("status", value as string)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                      selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <span>{label}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Команда</p>
            <div className="space-y-1">
              {facets.teams.map(([team, count]) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => applyUrlState({ team: urlState.team === team ? undefined : team })}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                    urlState.team === team ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  <span className="truncate">{team}</span>
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">SLA</p>
            <div className="space-y-1">
              {[
                ["breached", "Просрочены", facets.slaBreached],
                ["on-time", "В срок", facets.slaOnTime],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyUrlState({ sla: urlState.sla === value ? undefined : (value as string) })}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                    urlState.sla === value ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  <span>{label}</span>
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Покрытие</p>
            <div className="space-y-1 text-xs text-zinc-400">
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-zinc-900">
                <span>Без DAST</span>
                <span>{facets.noDast}</span>
              </div>
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-zinc-900">
                <span>Без SCA</span>
                <span>{facets.noSca}</span>
              </div>
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-zinc-900">
                <span>Без Secrets</span>
                <span>{facets.noSecrets}</span>
              </div>
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-zinc-900">
                <span>Полное</span>
                <span>{facets.fullCoverage}</span>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Теги</p>
            <div className="flex flex-wrap gap-1">
              {facets.tags.slice(0, 8).map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleMultiFilter("tag", tag)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    urlState.tag.includes(tag)
                      ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                      : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  {tag} · {count}
                </button>
              ))}
              {facets.tags.length > 8 && (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-500">
                  +{facets.tags.length - 8}
                </span>
              )}
            </div>
          </section>
        </aside>

        <div>
      {projects.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-400">
            <p className="text-sm">Ничего не найдено по выбранным фильтрам</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                applyUrlState({
                  q: undefined,
                  status: [],
                  tag: [],
                  team: undefined,
                  sla: undefined,
                  owner: undefined,
                })
              }
            >
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-zinc-100">Добро пожаловать</h3>
              <p className="text-sm text-zinc-400">Создайте первый проект любым удобным способом.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 text-left hover:border-zinc-700"
                onClick={() => navigate("/import")}
              >
                <p className="text-sm font-medium text-zinc-200">Импорт SARIF</p>
                <p className="mt-1 text-xs text-zinc-500">Загрузить результаты сканера.</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 text-left hover:border-zinc-700"
                onClick={() => setShowCreate(true)}
              >
                <p className="text-sm font-medium text-zinc-200">Подключить репозиторий</p>
                <p className="mt-1 text-xs text-zinc-500">Создать проект и добавить source.</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 text-left hover:border-zinc-700"
                onClick={() => setShowCreate(true)}
              >
                <p className="text-sm font-medium text-zinc-200">Создать вручную</p>
                <p className="mt-1 text-xs text-zinc-500">Пустой проект для последующей настройки.</p>
              </button>
            </div>
          </div>
        )
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
              onClick={() => navigate(`/findings?project_id=${p.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-zinc-200">{p.name}</CardTitle>
                {p.description && (
                  <CardDescription className="line-clamp-2 text-zinc-500">
                    {p.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {p.tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-zinc-800 text-xs text-zinc-400"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-600">
                  Обновлён{" "}
                  {formatDistanceToNow(new Date(p.updated_at), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="grid grid-cols-[28px_1fr_170px_64px_80px_34px_28px] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500">
            <span aria-hidden>★</span>
            <span>Проект</span>
            <span>Severity</span>
            <span>Trend</span>
            <span>Scanners</span>
            <span>Owner</span>
            <span aria-hidden>⋯</span>
          </div>
          <div className="max-h-[70vh] overflow-auto themed-scrollbar">
            <div className="divide-y divide-zinc-800">
            {sortedProjects.map((project) => (
              <div key={project.id}>
                <div
                  className={`grid cursor-pointer grid-cols-[28px_1fr_170px_64px_80px_34px_28px] items-start gap-2 px-3 py-3 ${
                    !project.setup_completed ? "bg-zinc-900/70" : "hover:bg-zinc-900/60"
                  }`}
                  onDoubleClick={() => navigate(`/projects/${project.id}`)}
                  onClick={() => openQuickPeek(project.id)}
                  role="row"
                >
                <button
                  type="button"
                  className="mt-0.5 text-zinc-400 hover:text-amber-300"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePinnedToggle(project);
                  }}
                  aria-label={project.pinned ? "Убрать из избранного" : "Добавить в избранное"}
                >
                  <Star
                    className={`size-4 ${project.pinned ? "fill-amber-300 text-amber-300" : ""}`}
                  />
                </button>

                <div className="min-w-0 space-y-1">
                  <div className="truncate text-sm font-medium text-zinc-100">{project.name}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {project.description || "Без описания"}
                  </div>
                  {!project.setup_completed && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/projects/${project.id}`);
                      }}
                      className="text-xs text-amber-300 hover:text-amber-200"
                    >
                      Подключить источник →
                    </button>
                  )}
                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-zinc-800 text-[10px] text-zinc-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/findings?project_id=${project.id}`);
                  }}
                  className="min-w-0 space-y-1 text-left"
                >
                  {(() => {
                    const sev = project.findings_by_severity;
                    const total =
                      sev.critical + sev.high + sev.medium + sev.low + sev.info;
                    const pct = (value: number) =>
                      total > 0 ? `${Math.max((value / total) * 100, value > 0 ? 2 : 0)}%` : "0%";
                    return (
                      <>
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <span className="h-full bg-red-500" style={{ width: pct(sev.critical) }} />
                          <span className="h-full bg-orange-500" style={{ width: pct(sev.high) }} />
                          <span className="h-full bg-amber-500" style={{ width: pct(sev.medium) }} />
                          <span className="h-full bg-sky-500" style={{ width: pct(sev.low) }} />
                          <span className="h-full bg-zinc-400" style={{ width: pct(sev.info) }} />
                        </div>
                        <div className="flex gap-1.5 text-[10px] tabular-nums">
                          <span className={severityTextColor(sev.critical, "critical")}>{sev.critical}</span>
                          <span className={severityTextColor(sev.high, "high")}>{sev.high}</span>
                          <span className={severityTextColor(sev.medium, "medium")}>{sev.medium}</span>
                          <span className={severityTextColor(sev.low, "low")}>{sev.low}</span>
                          <span className={severityTextColor(sev.info, "info")}>{sev.info}</span>
                        </div>
                      </>
                    );
                  })()}
                </button>

                <div ref={registerTrendTarget(project.id)} data-project-id={project.id} className="pt-0.5">
                  {(() => {
                    const points = trendCache[project.id]?.points ?? [];
                    const path = buildSparkline(points);
                    const first = points[0]?.count ?? 0;
                    const last = points[points.length - 1]?.count ?? 0;
                    const rising = first > 0 ? last > first * 1.1 : last > 0;
                    const falling = first > 0 ? last < first * 0.9 : false;
                    const isPaused = project.status === "paused" || project.status === "archived";
                    const strokeClass = isPaused
                      ? "stroke-zinc-500"
                      : rising
                        ? "stroke-red-400"
                        : falling
                          ? "stroke-emerald-400"
                          : "stroke-zinc-400";
                    return (
                      <svg width="58" height="24" viewBox="0 0 58 24" role="img" aria-label="Trend">
                        <path
                          d={path}
                          fill="none"
                          className={strokeClass}
                          strokeWidth="1.5"
                          strokeDasharray={isPaused ? "2 2" : undefined}
                        />
                      </svg>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${scannerClasses(project.scanners.sast)}`}
                    aria-label={`SAST: ${project.scanners.sast}`}
                    title={`SAST: ${project.scanners.sast}`}
                  >
                    S
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${scannerClasses(project.scanners.dast)}`}
                    aria-label={`DAST: ${project.scanners.dast}`}
                    title={`DAST: ${project.scanners.dast}`}
                  >
                    D
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${scannerClasses(project.scanners.sca)}`}
                    aria-label={`SCA: ${project.scanners.sca}`}
                    title={`SCA: ${project.scanners.sca}`}
                  >
                    C
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${scannerClasses(project.scanners.secrets)}`}
                    aria-label={`Secrets: ${project.scanners.secrets}`}
                    title={`Secrets: ${project.scanners.secrets}`}
                  >
                    K
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    applyUrlState({
                      owner: project.owner.id,
                    });
                  }}
                  title={project.owner.display_name || project.owner.email}
                  className={`mt-0.5 flex size-6 items-center justify-center rounded-full text-[10px] font-medium ${avatarColorSeed(project.owner.id)}`}
                >
                  {ownerInitials(project)}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-zinc-400 hover:text-zinc-200"
                    >
                      <EllipsisVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => handleRenameProject(project)}>Переименовать</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDuplicateProject(project)}>Дублировать</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleArchiveProject(project)}>Архивировать</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate(`/projects/${project.id}?tab=tokens`)}>
                      Настройки
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate(`/findings?project_id=${project.id}`)}>Экспорт</DropdownMenuItem>
                    {canDeleteProject(project) && (
                      <DropdownMenuItem
                        onSelect={() => handleDeleteProject(project)}
                        className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                      >
                        Удалить проект
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
                {activeQuickPeekId === project.id && (
                  <div className="border-t border-zinc-800 bg-zinc-900/40 px-3 py-3">
                    {loadingQuickPeekIds.has(project.id) ? (
                      <div className="text-xs text-zinc-500">Загрузка quick peek…</div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="mb-1 text-[11px] uppercase text-zinc-500">Top findings</p>
                          <ul className="space-y-1 text-xs">
                            {(quickPeekCache[project.id]?.data?.top_findings ?? []).slice(0, 5).map((finding) => (
                              <li key={finding.id} className="truncate text-zinc-300">
                                S{finding.severity} · {finding.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] uppercase text-zinc-500">Последние события</p>
                          <ul className="space-y-1 text-xs">
                            {(quickPeekCache[project.id]?.data?.events ?? []).slice(0, 5).map((event) => (
                              <li key={event.id} className="truncate text-zinc-400">
                                {event.action || event.method} · {event.path}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase text-zinc-500">Findings by status</p>
                          {(() => {
                            const stats = quickPeekCache[project.id]?.data?.status_stats;
                            const total = (stats?.new ?? 0) + (stats?.triaged ?? 0) + (stats?.fixed ?? 0) + (stats?.wontfix ?? 0);
                            const part = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
                            return (
                              <>
                                <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
                                  <span className="bg-sky-500" style={{ width: part(stats?.new ?? 0) }} />
                                  <span className="bg-amber-500" style={{ width: part(stats?.triaged ?? 0) }} />
                                  <span className="bg-emerald-500" style={{ width: part(stats?.fixed ?? 0) }} />
                                  <span className="bg-zinc-500" style={{ width: part(stats?.wontfix ?? 0) }} />
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
                                  <span>new: {stats?.new ?? 0}</span>
                                  <span>triaged: {stats?.triaged ?? 0}</span>
                                  <span>fixed: {stats?.fixed ?? 0}</span>
                                  <span>wontfix: {stats?.wontfix ?? 0}</span>
                                </div>
                              </>
                            );
                          })()}
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
                              Открыть
                            </Button>
                            <Button size="sm" variant="outline">Запустить скан</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/projects/${project.id}?tab=tokens`)}
                            >
                              Настройки
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      <CreateProjectWizardDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
