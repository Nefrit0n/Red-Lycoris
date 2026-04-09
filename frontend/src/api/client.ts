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
  const originPath = window.location.pathname;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
    const err = new ApiClientError(res.status, apiErr);
    if (res.status === 401 && !originPath.startsWith("/login")) {
      if (err.code === "SESSION_EXPIRED") {
        window.location.replace("/login?expired=1");
      } else if (err.code === "AUTHENTICATION_REQUIRED") {
        window.location.replace("/login");
      }
    }
    throw err;
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

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function apiDelete(path: string): Promise<void> {
  return request<void>("DELETE", path);
}

export { ApiClientError };
