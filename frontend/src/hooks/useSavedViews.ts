import { useCallback, useState, useEffect } from "react";
import { FiltersState } from "../features/filters/types";

export interface SavedView {
  id: string;
  name: string;
  filters: Partial<FiltersState>;
  isBuiltIn?: boolean;
  createdAt: string;
}

const STORAGE_KEY = "red_lycoris_saved_views";

// Built-in views that are always available
const BUILT_IN_VIEWS: SavedView[] = [
  {
    id: "critical-high",
    name: "Критичные и высокие",
    filters: {
      severities: ["critical", "high"],
      statuses: ["new"],
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "needs-triage",
    name: "Нужен триаж",
    filters: {
      statuses: ["new"],
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "false-positives",
    name: "Ложные срабатывания",
    filters: {
      statuses: ["false_positive"],
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "mitigated",
    name: "Митигированы",
    filters: {
      statuses: ["mitigated"],
    },
    isBuiltIn: true,
    createdAt: "",
  },
];

// Update built-in views with proper filters
BUILT_IN_VIEWS[0].filters = {
  statuses: ["new"],
  severities: ["critical", "high"],
};

function loadSavedViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load saved views:", e);
  }
  return [];
}

function persistSavedViews(views: SavedView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch (e) {
    console.error("Failed to save views:", e);
  }
}

export interface UseSavedViewsReturn {
  views: SavedView[];
  builtInViews: SavedView[];
  saveView: (name: string, filters: Partial<FiltersState>) => SavedView;
  deleteView: (id: string) => void;
  updateView: (id: string, name: string, filters: Partial<FiltersState>) => void;
  getViewById: (id: string) => SavedView | undefined;
}

export function useSavedViews(): UseSavedViewsReturn {
  const [views, setViews] = useState<SavedView[]>(() => loadSavedViews());

  // Persist to localStorage when views change
  useEffect(() => {
    persistSavedViews(views);
  }, [views]);

  const saveView = useCallback((name: string, filters: Partial<FiltersState>): SavedView => {
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name,
      filters: {
        productIds: filters.productIds,
        search: filters.search,
        severities: filters.severities,
        statuses: filters.statuses,
        riskBands: filters.riskBands,
        occurrences: filters.occurrences,
        scannerTypes: filters.scannerTypes,
        languages: filters.languages,
        policyDecisions: filters.policyDecisions,
        categories: filters.categories,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        datePreset: filters.datePreset,
        showRepeats: filters.showRepeats,
      },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };

    setViews((prev) => [...prev, newView]);
    return newView;
  }, []);

  const deleteView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const updateView = useCallback((id: string, name: string, filters: Partial<FiltersState>) => {
    setViews((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              name,
              filters: {
                productIds: filters.productIds,
                search: filters.search,
                severities: filters.severities,
                statuses: filters.statuses,
                riskBands: filters.riskBands,
                occurrences: filters.occurrences,
                scannerTypes: filters.scannerTypes,
                languages: filters.languages,
                policyDecisions: filters.policyDecisions,
                categories: filters.categories,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                datePreset: filters.datePreset,
                showRepeats: filters.showRepeats,
              },
            }
          : v
      )
    );
  }, []);

  const getViewById = useCallback(
    (id: string): SavedView | undefined => {
      return [...BUILT_IN_VIEWS, ...views].find((v) => v.id === id);
    },
    [views]
  );

  return {
    views,
    builtInViews: BUILT_IN_VIEWS,
    saveView,
    deleteView,
    updateView,
    getViewById,
  };
}
