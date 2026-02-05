import { useEffect, useMemo, useRef, useState } from "react";
import { fetchImportJobs } from "../../../api/importJobs";
import { fetchProducts } from "../../../api/products";
import { buildFindingsParamsFromFilters, fetchFindings } from "../../../api/findings";
import { FiltersState } from "../../filters/types";

export interface SelectOption {
  value: string;
  label: string;
}

const uniq = (items: string[]) => Array.from(new Set(items));

const fetchScannerOptions = async (signal?: AbortSignal): Promise<SelectOption[]> => {
  const limit = 200;
  const maxPages = 5;
  const scanners: string[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchImportJobs({ limit, offset: page * limit }, signal);
    const batch = response.data.map((job) => job.scanner).filter(Boolean);
    scanners.push(...batch);

    if (response.data.length < limit) {
      break;
    }
  }

  return uniq(scanners)
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

export const useScannerOptions = () => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchScannerOptions(controller.signal)
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
      filters.categories.join(","),
      debouncedSearch,
    ].join("|");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const controller = new AbortController();
    setLoading(true);
    fetchFindings(
      buildFindingsParamsFromFilters(
        { ...filters, page: 0, pageSize: 1 },
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
    filters.categories,
    filters.productIds,
    filters.riskBands,
    filters.scannerTypes,
    filters.severities,
    filters.showRepeats,
    filters.statuses,
  ]);

  return { facets, loading };
};
