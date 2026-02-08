import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_FILTERS_STATE, FiltersState } from "./types";
import { filtersAreEqual, filtersToQuery, normalizeFilters, queryToFilters } from "./url";
import useDebouncedValue from "../../hooks/useDebouncedValue";

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

export interface FiltersStateActions {
  state: FiltersState;
  setPartial: (partial: Partial<FiltersState>) => void;
  resetAll: () => void;
}

export function useFiltersState(): FiltersStateActions {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFilters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeFilters(queryToFilters(params, DEFAULT_FILTERS_STATE));
  }, [location.search]);

  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const lastPushedSearchRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);
  const debouncedSearch = useDebouncedValue(filters.search, 400);

  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    if (lastPushedSearchRef.current === location.search) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const nextFilters = normalizeFilters(queryToFilters(params, DEFAULT_FILTERS_STATE));

    setFilters((prev) => {
      return filtersAreEqual(prev, nextFilters) ? prev : nextFilters;
    });
  }, [location.search]);

  const syncState = useMemo(
    () =>
      normalizeFilters({
        ...filters,
        search: debouncedSearch,
      }),
    [debouncedSearch, filters]
  );

  useEffect(() => {
    const params = filtersToQuery(syncState);
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
  }, [debouncedSearch, location.pathname, location.search, navigate, syncState]);

  const setPartial = useCallback((partial: Partial<FiltersState>) => {
    setFilters((prev) => normalizeFilters({ ...prev, ...partial }));
  }, []);

  const resetAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS_STATE);
  }, []);

  const actionsRef = useRef<FiltersStateActions>({
    state: filters,
    setPartial,
    resetAll,
  });

  actionsRef.current = {
    state: filters,
    setPartial,
    resetAll,
  };

  return actionsRef.current;
}
