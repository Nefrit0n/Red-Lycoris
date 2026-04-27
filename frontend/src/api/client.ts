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

const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const originPath = window.location.pathname;
  const headers: HeadersInit = { "Content-Type": "application/json" };

  const opts: RequestInit = {
    method,
    headers,
    credentials: "include",
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, { ...opts, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiClientError(0, {
        code: "REQUEST_TIMEOUT",
        message: `request timed out after ${REQUEST_TIMEOUT_MS}ms`,
      });
    }

    throw new ApiClientError(0, {
      code: "NETWORK_ERROR",
      message: "network request failed",
    });
  } finally {
    window.clearTimeout(timeoutId);
  }

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
      if (err.code === "FORCE_PASSWORD_CHANGE" && !originPath.startsWith("/auth/change-password")) {
        window.location.replace("/auth/change-password");
      } else if (err.code === "SESSION_EXPIRED") {
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

export function apiDelete(path: string, body?: unknown): Promise<void> {
  return request<void>("DELETE", path, body);
}

export { ApiClientError };
