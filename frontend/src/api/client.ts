import type { ApiError } from "@/types";

class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, err: ApiError["error"]) {
    super(err.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = err.code;
    this.details = err.details;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(path, opts);

  if (!res.ok) {
    let apiErr: ApiError["error"];
    try {
      const json = (await res.json()) as ApiError;
      apiErr = json.error;
    } catch {
      apiErr = { code: "UNKNOWN", message: res.statusText };
    }
    throw new ApiClientError(res.status, apiErr);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function buildUrl(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${path}?${qs}` : path;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  return request<T>("GET", buildUrl(path, params));
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete(path: string): Promise<void> {
  return request<void>("DELETE", path);
}

export { ApiClientError };
