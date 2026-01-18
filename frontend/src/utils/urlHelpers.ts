/**
 * URL and Date utilities for Findings list
 */

/**
 * Normalizes a date string to ISO format with time set to start of day (00:00:00Z)
 */
export function normalizeDateFrom(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T00:00:00Z`).toISOString();
}

/**
 * Normalizes a date string to ISO format with time set to end of day (23:59:59Z)
 */
export function normalizeDateTo(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T23:59:59Z`).toISOString();
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
