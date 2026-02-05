import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FindingListItemDTO } from "../types/findings";
import { DEFAULT_FILTERS_STATE, FiltersState } from "../types/filters";
import {
  filtersAreEqual,
  filtersToQuery,
  normalizeFilters,
  queryToFilters,
} from "../utils/filters";

export interface FiltersActions {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setProductIds: (value: string[]) => void;
  setSearch: (value: string) => void;
  setSeverities: (value: FiltersState["severities"]) => void;
  setStatuses: (value: FiltersState["statuses"]) => void;
  setScannerTypes: (value: string[]) => void;
  setPolicyDecisions: (value: FiltersState["policyDecisions"]) => void;
  setOccurrences: (value: FiltersState["occurrences"]) => void;
  setRiskBands: (value: FiltersState["riskBands"]) => void;
  setCategories: (value: FiltersState["categories"]) => void;
  setDatePreset: (value: FiltersState["datePreset"]) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setShowRepeats: (value: boolean) => void;
  setImportJobId: (value: string) => void;
  setSortField: (value: keyof FindingListItemDTO) => void;
  setSortOrder: (value: "asc" | "desc") => void;
  setSelectedFindingId: (value: string | null) => void;
  resetAll: () => void;
  applyPreset: (presetId: string) => void;
}

const normalizeSearchParams = (search: string) => {
  const params = new URLSearchParams(search);
  const normalizedEntries: Array<[string, string]> = [];

  params.forEach((value, key) => {
    const normalizedKey = key === "productId" ? "product" : key;
    normalizedEntries.push([normalizedKey, value]);
  });

  normalizedEntries.sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA === keyB) {
      return valueA.localeCompare(valueB);
    }
    return keyA.localeCompare(keyB);
  });

  return normalizedEntries;
};

const areSearchParamsEqual = (left: string, right: string) => {
  const leftParams = normalizeSearchParams(left);
  const rightParams = normalizeSearchParams(right);
  return (
    leftParams.length === rightParams.length &&
    leftParams.every(([key, value], index) => {
      const [rightKey, rightValue] = rightParams[index];
      return key === rightKey && value === rightValue;
    })
  );
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

export function useFiltersState(): [FiltersState, FiltersActions, boolean] {
  const location = useLocation();
  const navigate = useNavigate();

  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS_STATE);
  const lastPushedSearchRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);

  // URL -> State
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    if (lastPushedSearchRef.current === location.search) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const nextFilters = queryToFilters(params, DEFAULT_FILTERS_STATE);

    setFilters((prev) => {
      const normalizedNext = normalizeFilters(nextFilters);
      return filtersAreEqual(prev, normalizedNext) ? prev : normalizedNext;
    });

    setHydrated(true);
  }, [location.search]);

  // State -> URL
  useEffect(() => {
    if (!hydrated) return;

    const params = filtersToQuery(filters);
    const newSearch = params.toString() ? `?${params.toString()}` : "";

    if (newSearch === location.search) {
      return;
    }

    if (newSearch === lastPushedSearchRef.current) {
      return;
    }

    const defaultParams = filtersToQuery(DEFAULT_FILTERS_STATE).toString();
    const shouldSkipDefaultNavigation =
      location.search === "" && areSearchParamsEqual(params.toString(), defaultParams);

    if (shouldSkipDefaultNavigation) {
      return;
    }

    isNavigatingRef.current = true;
    lastPushedSearchRef.current = newSearch;

    navigate(
      {
        pathname: location.pathname,
        search: newSearch,
      },
      { replace: true }
    );
  }, [filters, hydrated, location.pathname, location.search, navigate]);

  const setPage = useCallback((page: number) => setFilters((prev) => ({ ...prev, page })), []);
  const setPageSize = useCallback(
    (pageSize: number) =>
      setFilters((prev) => ({ ...prev, pageSize, page: 0 })),
    []
  );
  const setProductIds = useCallback(
    (productIds: string[]) =>
      setFilters((prev) => ({ ...prev, productIds, page: 0 })),
    []
  );
  const setSearch = useCallback(
    (search: string) => setFilters((prev) => ({ ...prev, search, page: 0 })),
    []
  );
  const setSeverities = useCallback(
    (severities: FiltersState["severities"]) =>
      setFilters((prev) => ({ ...prev, severities, page: 0 })),
    []
  );
  const setStatuses = useCallback(
    (statuses: FiltersState["statuses"]) =>
      setFilters((prev) => ({ ...prev, statuses, page: 0 })),
    []
  );
  const setScannerTypes = useCallback(
    (scannerTypes: string[]) =>
      setFilters((prev) => ({ ...prev, scannerTypes, page: 0 })),
    []
  );
  const setPolicyDecisions = useCallback(
    (policyDecisions: FiltersState["policyDecisions"]) =>
      setFilters((prev) => ({ ...prev, policyDecisions, page: 0 })),
    []
  );
  const setOccurrences = useCallback(
    (occurrences: FiltersState["occurrences"]) =>
      setFilters((prev) => ({ ...prev, occurrences, page: 0 })),
    []
  );
  const setRiskBands = useCallback(
    (riskBands: FiltersState["riskBands"]) =>
      setFilters((prev) => ({ ...prev, riskBands, page: 0 })),
    []
  );
  const setCategories = useCallback(
    (categories: FiltersState["categories"]) =>
      setFilters((prev) => ({ ...prev, categories, page: 0 })),
    []
  );
  const setDatePreset = useCallback(
    (datePreset: FiltersState["datePreset"]) =>
      setFilters((prev) => ({ ...prev, datePreset, page: 0 })),
    []
  );
  const setDateFrom = useCallback(
    (dateFrom: string) => setFilters((prev) => ({ ...prev, dateFrom, page: 0 })),
    []
  );
  const setDateTo = useCallback(
    (dateTo: string) => setFilters((prev) => ({ ...prev, dateTo, page: 0 })),
    []
  );
  const setShowRepeats = useCallback(
    (showRepeats: boolean) => setFilters((prev) => ({ ...prev, showRepeats, page: 0 })),
    []
  );
  const setImportJobId = useCallback(
    (importJobId: string) => setFilters((prev) => ({ ...prev, importJobId, page: 0 })),
    []
  );
  const setSortField = useCallback(
    (sortField: keyof FindingListItemDTO) =>
      setFilters((prev) => ({ ...prev, sortField, page: 0 })),
    []
  );
  const setSortOrder = useCallback(
    (sortOrder: "asc" | "desc") => setFilters((prev) => ({ ...prev, sortOrder, page: 0 })),
    []
  );
  const setSelectedFindingId = useCallback(
    (selectedFindingId: string | null) =>
      setFilters((prev) => ({ ...prev, selectedFindingId })),
    []
  );

  const resetAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS_STATE);
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    setFilters((prev) => {
      switch (presetId) {
        case "critical-high":
          return {
            ...prev,
            severities: ["critical", "high"],
            page: 0,
          };
        case "open-only":
          return { ...prev, statuses: ["new"], page: 0 };
        case "last-24h":
          return {
            ...prev,
            datePreset: "24h",
            dateFrom: daysAgo(1),
            dateTo: "",
            page: 0,
          };
        case "sast":
          return { ...prev, categories: ["SAST"], page: 0 };
        case "sca":
          return { ...prev, categories: ["SCA"], page: 0 };
        case "secrets":
          return { ...prev, categories: ["SECRETS"], page: 0 };
        default:
          return prev;
      }
    });
  }, []);

  const actionsRef = useRef<FiltersActions>({
    setPage,
    setPageSize,
    setProductIds,
    setSearch,
    setSeverities,
    setStatuses,
    setScannerTypes,
    setPolicyDecisions,
    setOccurrences,
    setRiskBands,
    setCategories,
    setDatePreset,
    setDateFrom,
    setDateTo,
    setShowRepeats,
    setImportJobId,
    setSortField,
    setSortOrder,
    setSelectedFindingId,
    resetAll,
    applyPreset,
  });

  actionsRef.current = {
    setPage,
    setPageSize,
    setProductIds,
    setSearch,
    setSeverities,
    setStatuses,
    setScannerTypes,
    setPolicyDecisions,
    setOccurrences,
    setRiskBands,
    setCategories,
    setDatePreset,
    setDateFrom,
    setDateTo,
    setShowRepeats,
    setImportJobId,
    setSortField,
    setSortOrder,
    setSelectedFindingId,
    resetAll,
    applyPreset,
  };

  return [filters, actionsRef.current, hydrated];
}
