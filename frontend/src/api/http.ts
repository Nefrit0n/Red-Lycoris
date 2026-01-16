const TOKEN_KEY = "lotus_warden_token";

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
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
  const payload = await response.json();
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.error || "Ошибка запроса");
    }
  }
  return payload as T;
};
