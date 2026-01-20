import { useCallback, useState, useEffect } from "react";
import { FiltersState } from "./useUrlFiltersSync";

export interface SavedView {
  id: string;
  name: string;
  filters: Partial<FiltersState>;
  isBuiltIn?: boolean;
  createdAt: string;
}

const STORAGE_KEY = "lotus_warden_saved_views";

// Built-in views that are always available
const BUILT_IN_VIEWS: SavedView[] = [
  {
    id: "critical-high",
    name: "Critical & High",
    filters: {
      filterSeverity: "",
      filterStatus: "new",
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "needs-triage",
    name: "Needs Triage",
    filters: {
      filterStatus: "new",
      filterSeverity: "",
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "false-positives",
    name: "False Positives",
    filters: {
      filterStatus: "false_positive",
    },
    isBuiltIn: true,
    createdAt: "",
  },
  {
    id: "mitigated",
    name: "Mitigated",
    filters: {
      filterStatus: "mitigated",
    },
    isBuiltIn: true,
    createdAt: "",
  },
];

// Update built-in views with proper filters
BUILT_IN_VIEWS[0].filters = {
  filterStatus: "new",
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
        productId: filters.productId,
        searchInput: filters.searchInput,
        filterSeverity: filters.filterSeverity,
        filterStatus: filters.filterStatus,
        filterOccurrence: filters.filterOccurrence,
        filterScannerType: filters.filterScannerType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
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
                productId: filters.productId,
                searchInput: filters.searchInput,
                filterSeverity: filters.filterSeverity,
                filterStatus: filters.filterStatus,
                filterOccurrence: filters.filterOccurrence,
                filterScannerType: filters.filterScannerType,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
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
