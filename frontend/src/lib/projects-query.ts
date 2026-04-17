export type ProjectsViewMode = "grid" | "list";
export type ProjectsSortMode =
  | "critical-desc"
  | "name"
  | "scan-date"
  | "trend"
  | "created-at";

export interface ProjectsUrlState {
  view?: ProjectsViewMode;
  status: string[];
  team?: string;
  sla?: string;
  tag: string[];
  q?: string;
  sort: ProjectsSortMode;
  owner?: string;
  cursor?: string;
}

const DEFAULT_SORT: ProjectsSortMode = "critical-desc";

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseProjectsUrlParams(params: URLSearchParams): ProjectsUrlState {
  const rawView = params.get("view");
  const view: ProjectsViewMode | undefined =
    rawView === "grid" || rawView === "list" ? rawView : undefined;

  const rawSort = params.get("sort");
  const sort: ProjectsSortMode =
    rawSort === "critical-desc" ||
    rawSort === "name" ||
    rawSort === "scan-date" ||
    rawSort === "trend" ||
    rawSort === "created-at"
      ? rawSort
      : DEFAULT_SORT;

  const q = params.get("q")?.trim() || undefined;
  const team = params.get("team")?.trim() || undefined;
  const sla = params.get("sla")?.trim() || undefined;
  const owner = params.get("owner")?.trim() || undefined;
  const cursor = params.get("cursor")?.trim() || undefined;

  return {
    view,
    status: parseCsv(params.get("status")),
    team,
    sla,
    tag: parseCsv(params.get("tag")),
    q,
    sort,
    owner,
    cursor,
  };
}

export function serializeProjectsUrlParams(
  state: Partial<ProjectsUrlState>,
): URLSearchParams {
  const next = new URLSearchParams();

  if (state.view) next.set("view", state.view);
  if (state.status && state.status.length > 0) {
    next.set("status", state.status.join(","));
  }
  if (state.team) next.set("team", state.team);
  if (state.sla) next.set("sla", state.sla);
  if (state.tag && state.tag.length > 0) {
    next.set("tag", state.tag.join(","));
  }
  if (state.q) next.set("q", state.q);
  if (state.sort && state.sort !== DEFAULT_SORT) {
    next.set("sort", state.sort);
  }
  if (state.owner) next.set("owner", state.owner);
  if (state.cursor) next.set("cursor", state.cursor);

  return next;
}
