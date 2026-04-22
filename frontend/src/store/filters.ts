import { create } from "zustand";

type SortDir = "asc" | "desc";

interface FiltersState {
  severities: number[];
  statuses: number[];
  query: string;
  projectId: string | null;
  sortField: string;
  sortDir: SortDir;

  setSeverities: (values: number[]) => void;
  setStatuses: (values: number[]) => void;
  setQuery: (value: string) => void;
  setProjectId: (value: string | null) => void;
  setSort: (field: string, dir: SortDir) => void;
  resetFilters: () => void;
}

const initialState = {
  severities: [] as number[],
  statuses: [] as number[],
  query: "",
  projectId: null as string | null,
  sortField: "priority_score",
  sortDir: "desc" as SortDir,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setSeverities: (severities) =>
    set({
      severities: Array.isArray(severities) ? severities : [],
    }),

  setStatuses: (statuses) =>
    set({
      statuses: Array.isArray(statuses) ? statuses : [],
    }),

  setQuery: (query) =>
    set({
      query: typeof query === "string" ? query : "",
    }),

  setProjectId: (projectId) =>
    set({
      projectId: projectId ?? null,
    }),

  setSort: (sortField, sortDir) =>
    set({
      sortField: sortField || "priority_score",
      sortDir: sortDir === "asc" ? "asc" : "desc",
    }),

  resetFilters: () => set(initialState),
}));