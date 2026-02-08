import { FiltersState } from "./types";

/**
 * URL and Date utilities for Findings list
 */

/**
 * Normalizes a date string to ISO format with time set to start of day (00:00:00Z)
 */
export function normalizeDateFrom(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const normalizedDate = normalizeDateInput(dateStr);
  if (!normalizedDate) return undefined;
  const parsed = new Date(`${normalizedDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

/**
 * Normalizes a date string to ISO format with time set to end of day (23:59:59Z)
 */
export function normalizeDateTo(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const normalizedDate = normalizeDateInput(dateStr);
  if (!normalizedDate) return undefined;
  const parsed = new Date(`${normalizedDate}T23:59:59Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

const DATE_PATTERN_DD_MM_YYYY = /^\d{2}[.-]\d{2}[.-]\d{4}$/;
const DATE_PATTERN_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateInput(dateStr: string): string | undefined {
  if (DATE_PATTERN_YYYY_MM_DD.test(dateStr)) {
    return dateStr;
  }

  if (DATE_PATTERN_DD_MM_YYYY.test(dateStr)) {
    const [day, month, year] = dateStr.split(/[.-]/);
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

/**
 * Builds URL search params from filter values
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const urlParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      urlParams.set(key, String(value));
    }
  });

  return urlParams.toString();
}

/**
 * Safely gets a URL parameter value
 */
export function getUrlParam(search: string, key: string, defaultValue: string = ''): string {
  const params = new URLSearchParams(search);
  return params.get(key) ?? defaultValue;
}

/**
 * Safely gets a URL parameter as number
 */
export function getUrlParamNumber(search: string, key: string, defaultValue: number): number {
  const value = getUrlParam(search, key);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Safely gets a URL parameter as boolean
 */
export function getUrlParamBoolean(search: string, key: string, defaultValue: boolean = false): boolean {
  const value = getUrlParam(search, key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

export function mapFiltersToApiParams(state: FiltersState): URLSearchParams {
  const params = new URLSearchParams();

  const appendArray = (key: string, values: string[]) => {
    values.forEach((value) => {
      if (value) {
        params.append(key, value);
      }
    });
  };

  appendArray("product", state.productIds);
  appendArray("severity", state.severities);
  appendArray("status", state.statuses);
  appendArray("category", state.categories);
  appendArray("scannerType", state.scannerTypes);
  appendArray("occurrenceStatus", state.occurrences);
  appendArray("riskBand", state.riskBands);
  appendArray("policyDecision", state.policyDecisions);

  if (state.search) params.set("search", state.search);
  if (state.datePreset) params.set("datePreset", state.datePreset);

  const dateFrom = normalizeDateFrom(state.dateFrom);
  const dateTo = normalizeDateTo(state.dateTo);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  params.set("canonicalOnly", String(!state.showRepeats));
  params.set("includeRepeats", String(state.showRepeats));

  return params;
}
