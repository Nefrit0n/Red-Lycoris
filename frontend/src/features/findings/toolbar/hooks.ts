import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProducts } from "../../../api/products";
import { buildFindingsParamsFromFilters, fetchFindings } from "../../../api/findings";
import { FiltersState } from "../../filters/types";

export interface SelectOption {
  value: string;
  label: string;
}

const fetchScannerOptions = async (
  filters: FiltersState,
  searchOverride?: string,
  signal?: AbortSignal
): Promise<SelectOption[]> => {
  const response = await fetchFindings(
    buildFindingsParamsFromFilters(
      { ...filters, page: 0, pageSize: 1, scannerTypes: [] },
      { includeMeta: true, searchOverride }
    ),
    signal
  );

  const counts = response.meta?.scannerCounts ?? {};
  return Object.keys(counts)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
};

const fetchProductOptions = async (signal?: AbortSignal): Promise<SelectOption[]> => {
  const limit = 200;
  const maxPages = 5;
  const products: SelectOption[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchProducts(limit, page * limit, signal);
    products.push(
      ...response.data.map((product) => ({ value: product.id, label: product.name }))
    );

    if (response.data.length < limit) {
      break;
    }
  }

  return products.sort((a, b) => a.label.localeCompare(b.label));
};

export const useScannerOptions = (filters: FiltersState, searchOverride?: string) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const key = [
      filters.productIds.join(","),
      filters.severities.join(","),
      filters.statuses.join(","),
      filters.riskBands.join(","),
      filters.occurrences.join(","),
      filters.policyDecisions.join(","),
      filters.categories.join(","),
      filters.datePreset,
      filters.dateFrom,
      filters.dateTo,
      filters.showRepeats,
      searchOverride ?? filters.search,
    ].join("|");
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const controller = new AbortController();
    setLoading(true);
    fetchScannerOptions(filters, searchOverride, controller.signal)
      .then((data) => {
        setOptions(data);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    filters.categories,
    filters.dateFrom,
    filters.datePreset,
    filters.dateTo,
    filters.occurrences,
    filters.policyDecisions,
    filters.productIds,
    filters.riskBands,
    filters.severities,
    filters.showRepeats,
    filters.statuses,
    filters.search,
    searchOverride,
  ]);

  return { options, loading };
};

export const useProductOptions = () => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchProductOptions(controller.signal)
      .then((data) => {
        setOptions(data);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return { options, loading };
};

export const useOptionLookup = (options: SelectOption[]) => {
  return useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [options]);
};

export interface CategoryFacet {
  category: string;
  count: number;
}

export const useCategoryFacets = (filters: FiltersState, debouncedSearch: string) => {
  const [facets, setFacets] = useState<CategoryFacet[]>([]);
  const [loading, setLoading] = useState(true);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const key = [
      filters.productIds.join(","),
      filters.severities.join(","),
      filters.statuses.join(","),
      filters.riskBands.join(","),
      filters.occurrences.join(","),
      filters.scannerTypes.join(","),
      filters.policyDecisions.join(","),
      filters.datePreset,
      filters.dateFrom,
      filters.dateTo,
      filters.showRepeats,
      debouncedSearch,
    ].join("|");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const controller = new AbortController();
    setLoading(true);
    fetchFindings(
      buildFindingsParamsFromFilters(
        { ...filters, page: 0, pageSize: 1, categories: [] },
        { includeMeta: true, searchOverride: debouncedSearch }
      ),
      controller.signal
    )
      .then((response) => {
        setFacets(response.meta?.categoryCounts ?? []);
      })
      .catch(() => {
        setFacets([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    debouncedSearch,
    filters.dateFrom,
    filters.datePreset,
    filters.dateTo,
    filters.occurrences,
    filters.policyDecisions,
    filters.productIds,
    filters.riskBands,
    filters.scannerTypes,
    filters.severities,
    filters.showRepeats,
    filters.statuses,
  ]);

  return { facets, loading };
};
