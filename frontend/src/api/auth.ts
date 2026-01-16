import { ChangePasswordRequest, LoginRequest, LoginResponse } from "../types/auth";
import { clearToken, getAuthHeaders, setToken } from "./http";
import { parseApiResponse } from "./http";

export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
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
  return result.data;
};

export const changePassword = async (payload: ChangePasswordRequest): Promise<void> => {
  const response = await fetch("/api/v1/auth/change_password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  await parseApiResponse(response);
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
