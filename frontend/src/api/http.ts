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

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const parseApiResponse = async <T>(response: Response): Promise<T> => {
  let payload: any;

  try {
    payload = await response.json();
  } catch {
    // backend вернул не-JSON (nginx, proxy, 502, etc.)
    throw new Error(`Invalid server response (${response.status})`);
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.error || "Ошибка запроса");
    }
    return payload as T;
  }

  // Если backend вернул "чистый" JSON без success
  return payload as T;
};
