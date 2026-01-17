const TOKEN_KEY = "lotus_warden_token";

/** =========================
 *  Token helpers
 *  ========================= */
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * JSON requests only
 */
export const getJsonHeaders = (): HeadersInit => ({
  ...getAuthHeaders(),
  "Content-Type": "application/json",
});

/** =========================
 *  API error
 *  ========================= */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    opts: { status: number; code?: string; details?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

/** =========================
 *  Internal helpers
 *  ========================= */
type SuccessEnvelope = {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  total?: number;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isJsonContentType = (contentType: string) =>
  contentType.includes("application/json") || contentType.includes("+json");

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractErrorMessage = (
  payload: unknown,
  rawText: string,
  status: number
): string => {
  // 1) success envelope
  if (isObject(payload) && "success" in payload) {
    const env = payload as unknown as SuccessEnvelope;
    return env.error || env.message || `HTTP ${status}`;
  }

  // 2) common shapes
  if (isObject(payload)) {
    const p = payload as Record<string, unknown>;
    const msg =
      (typeof p.error === "string" && p.error) ||
      (typeof p.message === "string" && p.message) ||
      (typeof p.detail === "string" && (p.detail as string));
    if (msg) return msg;
  }

  // 3) fallback to raw body
  const trimmed = (rawText || "").trim();
  if (trimmed) return trimmed.slice(0, 300);

  return `HTTP ${status}`;
};

const unwrapSuccessEnvelope = (payload: unknown): unknown => {
  if (!isObject(payload)) return payload;
  if (!("success" in payload)) return payload;

  const env = payload as unknown as SuccessEnvelope;
  if (!env.success) {
    throw new ApiError(env.error || env.message || "Ошибка запроса", {
      status: 400,
      code: "SUCCESS_ENVELOPE_ERROR",
      details: payload,
    });
  }
  return env.data ?? payload;
};

/**
 * Reads body once, tries JSON when applicable.
 * Throws ApiError for any non-OK HTTP status.
 */
const readPayloadOrThrow = async (response: Response): Promise<unknown> => {
  const status = response.status;
  if (status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  const payload = isJsonContentType(contentType) ? safeJsonParse(rawText) : null;

  // Any non-2xx -> throw, including 401/403/5xx
  if (!response.ok) {
    const code =
      status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : "HTTP_ERROR";

    const msg = extractErrorMessage(payload, rawText, status);

    throw new ApiError(msg, {
      status,
      code,
      details: payload ?? rawText,
    });
  }

  // OK response
  if (isJsonContentType(contentType)) {
    // if parsing failed but server said json — still return raw text to avoid silent nulls
    return payload ?? rawText;
  }

  // Non-json OK (rare) → return text
  return rawText;
};

/** =========================
 *  Public parsers
 *  ========================= */

/**
 * ✅ Normal parser (detail/create/update)
 * - understands {success,data,error}
 * - throws ApiError on any !ok, including 401/403
 */
export const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const payload = await readPayloadOrThrow(response);
  const unwrapped = unwrapSuccessEnvelope(payload);
  return (unwrapped ?? ({} as unknown)) as T;
};

/**
 * ✅ Parser that keeps the wrapper (meta/total/etc),
 * but still validates success=true if it's a success envelope.
 */
export const parseApiResponseWithMeta = async <T>(
  response: Response
): Promise<T> => {
  const payload = await readPayloadOrThrow(response);

  if (isObject(payload) && "success" in payload) {
    const env = payload as unknown as SuccessEnvelope;
    if (!env.success) {
      throw new ApiError(env.error || env.message || "Ошибка запроса", {
        status: 400,
        code: "SUCCESS_ENVELOPE_ERROR",
        details: payload,
      });
    }
    return payload as T;
  }

  return (payload ?? ({} as unknown)) as T;
};

export const parseListApiResponse = async <T>(
  response: Response
): Promise<{ data: T[]; total: number }> => {
  const payload = await readPayloadOrThrow(response);
  const root = unwrapSuccessEnvelope(payload);

  // array directly
  // ✅ FIX: если root = data[] из success envelope, то total лежит в исходном payload
  if (Array.isArray(root)) {
    const totalFromPayload =
      isObject(payload) && typeof (payload as any).total === "number"
        ? (payload as any).total
        : isObject(payload) && typeof (payload as any).count === "number"
          ? (payload as any).count
          : undefined;

    const fixedTotal =
      typeof totalFromPayload === "number" && totalFromPayload > 0
        ? totalFromPayload
        : root.length;

    return { data: root as T[], total: fixedTotal };
  }

  if (!isObject(root)) {
    return { data: [], total: 0 };
  }

  // total/count can live in root or in original payload envelope
  const totalFromRoot =
    typeof (root as any).total === "number"
      ? (root as any).total
      : typeof (root as any).count === "number"
        ? (root as any).count
        : undefined;

  const totalFromPayload2 =
    isObject(payload) && typeof (payload as any).total === "number"
      ? (payload as any).total
      : isObject(payload) && typeof (payload as any).count === "number"
        ? (payload as any).count
        : undefined;

  const total = (totalFromRoot ?? totalFromPayload2 ?? 0) as number;

  const arr =
    Array.isArray((root as any).data)
      ? (root as any).data
      : Array.isArray((root as any).items)
        ? (root as any).items
        : Array.isArray((root as any).results)
          ? (root as any).results
          : isObject((root as any).data) && Array.isArray((root as any).data.data)
            ? (root as any).data.data
            : isObject((root as any).data) && Array.isArray((root as any).data.items)
              ? (root as any).data.items
              : isObject((root as any).data) && Array.isArray((root as any).data.results)
                ? (root as any).data.results
                : [];

  const fixedTotal2 = total > 0 ? total : arr.length;

  return { data: arr as T[], total: fixedTotal2 };
};
