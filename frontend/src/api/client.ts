import type { ApiError } from "@/types";

const AUTH_TOKEN_KEY = "rl_auth_token";

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

function readAuthToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const originPath = window.location.pathname;
  const token = readAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const opts: RequestInit = {
    method,
    headers,
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
      setAuthToken(null);
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
