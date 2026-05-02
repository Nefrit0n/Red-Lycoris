import type { Project } from "@/types";
import type { ProjectsUrlState } from "@/lib/projects-query";

export function groupPinnedFirst(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.pinned === b.pinned) {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return a.pinned ? -1 : 1;
  });
}

export function hasProjectsFilters(state: ProjectsUrlState): boolean {
  return Boolean(state.q) ||
    state.status.length > 0 ||
    state.coverage.length > 0 ||
    state.tag.length > 0 ||
    Boolean(state.team) ||
    Boolean(state.sla) ||
    Boolean(state.owner);
}
