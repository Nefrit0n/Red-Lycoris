const TOKEN_KEY = "lotus_warden_token";


export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

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


export const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const status = response.status;
  const contentType = response.headers.get("content-type") || "";

  // 204 No Content
  if (status === 204) {
    return {} as T;
  }

  // Non-JSON response → show raw text
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Unexpected response (${status}): ${text.slice(0, 300)}`
    );
  }

  const payload = await response.json();

  // Legacy wrapper support
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.error || "Ошибка запроса");
    }
    return (payload.data ?? payload) as T;
  }

  return payload as T;
};

export const parseApiResponseWithMeta = async <T>(
  response: Response
): Promise<T> => {
  const status = response.status;
  const contentType = response.headers.get("content-type") || "";

  if (status === 204) {
    return {} as T;
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Unexpected response (${status}): ${text.slice(0, 300)}`
    );
  }

  const payload = await response.json();

  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.error || "Ошибка запроса");
    }
    return payload as T;
  }

  return payload as T;
};
