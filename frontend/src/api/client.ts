import {
  ApiError,
  getAuthHeaders,
  getJsonHeaders,
  parseApiResponse,
  parseApiResponseWithMeta,
  parseListApiResponse,
} from "./http";

type QueryValue = string | number | boolean | null | undefined;

export type RequestConfig<T> = {
  method?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown>;
  query?: URLSearchParams | Record<string, QueryValue>;
  parse?: (response: Response) => Promise<T>;
  json?: boolean;
};

const buildQueryString = (query?: URLSearchParams | Record<string, QueryValue>): string => {
  if (!query) return "";
  if (query instanceof URLSearchParams) {
    const value = query.toString();
    return value ? `?${value}` : "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
};

const isFormData = (body: BodyInit | Record<string, unknown>): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

const shouldUseJson = (config: RequestConfig<unknown>): boolean => {
  if (typeof config.json === "boolean") return config.json;
  if (!config.body) return false;
  if (typeof config.body === "string") return false;
  if (isFormData(config.body)) return false;
  return true;
};

const buildHeaders = (config: RequestConfig<unknown>): HeadersInit => {
  const useJson = shouldUseJson(config);
  const baseHeaders = useJson ? getJsonHeaders() : getAuthHeaders();
  return {
    ...baseHeaders,
    ...(config.headers ?? {}),
  };
};

const buildBody = (config: RequestConfig<unknown>): BodyInit | undefined => {
  if (config.body === undefined) return undefined;
  if (typeof config.body === "string") return config.body;
  if (isFormData(config.body)) return config.body;
  if (shouldUseJson(config)) {
    return JSON.stringify(config.body);
  }
  return config.body as BodyInit;
};

export const request = async <T>(
  path: string,
  config: RequestConfig<T> = {}
): Promise<T> => {
  const queryString = buildQueryString(config.query);
  const url = `${path}${queryString}`;
  const init: RequestInit = {
    method: config.method ?? "GET",
    headers: buildHeaders(config),
    body: buildBody(config),
    signal: config.signal,
  };

  try {
    const response = await fetch(url, init);
    const parser = config.parse ?? parseApiResponse<T>;
    return await parser(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError("Network error", {
      status: 0,
      code: "NETWORK_ERROR",
      details: error,
    });
  }
};

export const requestList = async <T>(
  path: string,
  config: RequestConfig<{ data: T[]; total: number }> = {}
): Promise<{ data: T[]; total: number }> =>
  request(path, {
    ...config,
    parse: config.parse ?? parseListApiResponse<T>,
  });

export const requestWithMeta = async <T>(
  path: string,
  config: RequestConfig<T> = {}
): Promise<T> =>
  request(path, {
    ...config,
    parse: config.parse ?? parseApiResponseWithMeta<T>,
  });

export const requestBlob = async (
  path: string,
  config: RequestConfig<Blob> = {}
): Promise<Blob> =>
  request(path, {
    ...config,
    parse: async (response) => {
      if (!response.ok) {
        await parseApiResponse(response.clone());
      }
      return response.blob();
    },
  });

export { ApiError, getAuthHeaders, getJsonHeaders, parseApiResponse };
