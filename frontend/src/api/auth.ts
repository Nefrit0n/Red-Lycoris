import { LoginRequest, LoginResponse, UserProfile } from "../types/auth";
import { clearToken, getAuthHeaders, setToken } from "./http";
import { parseApiResponse } from "./http";

export const login = async (payload: LoginRequest): Promise<UserProfile> => {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Неверный email или пароль");
  }

  const result = await parseApiResponse<{ data: LoginResponse }>(response);
  setToken(result.data.token);
  return result.data.user;
};

export const logout = async (): Promise<void> => {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
  });
  clearToken();
};
