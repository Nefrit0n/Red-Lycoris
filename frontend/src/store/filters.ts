import { create } from "zustand";

interface FiltersState {
  severities: number[];
  statuses: number[];
  query: string;
  projectId: string | null;
  sortField: string;
  sortDir: "asc" | "desc";
  cursor: string | null;

  setSeverities: (v: number[]) => void;
  setStatuses: (v: number[]) => void;
  setQuery: (v: string) => void;
  setProject: (v: string | null) => void;
  setSort: (field: string, dir: "asc" | "desc") => void;
  nextPage: (cursor: string) => void;
  resetFilters: () => void;
}

const initialState = {
  severities: [] as number[],
  statuses: [] as number[],
  query: "",
  projectId: null as string | null,
  sortField: "priority_score",
  sortDir: "desc" as const,
  cursor: null as string | null,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setSeverities: (severities) => set({ severities, cursor: null }),
  setStatuses: (statuses) => set({ statuses, cursor: null }),
  setQuery: (query) => set({ query, cursor: null }),
  setProject: (projectId) => set({ projectId, cursor: null }),
  setSort: (sortField, sortDir) => set({ sortField, sortDir, cursor: null }),
  nextPage: (cursor) => set({ cursor }),
  resetFilters: () => set(initialState),
}));
