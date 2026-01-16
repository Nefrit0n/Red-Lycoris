import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from "../types/auth";
import {
  clearToken,
  getAuthHeaders,
  setToken,
} from "./http";
import { parseApiResponse } from "./http";

const NEEDS_PWD_CHANGE_KEY = "lotus_warden_needs_pwd_change";

/**
 * Login user
 */
export const login = async (
  payload: LoginRequest
): Promise<LoginResponse> => {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Неверный логин или пароль");
    }
    if (response.status === 403) {
      throw new Error("Доступ запрещён");
    }
    if (response.status === 404) {
      throw new Error("API недоступен (404)");
    }
    throw new Error(`Ошибка входа (${response.status})`);
  }

  const result = await parseApiResponse<{ data: LoginResponse }>(response);

  // 🔐 Сохраняем JWT
  setToken(result.data.token);

  // 🔑 Сохраняем флаг forced password change
  localStorage.setItem(
    NEEDS_PWD_CHANGE_KEY,
    String(result.data.needsPasswordChange)
  );

  return result.data;
};

/**
 * Change password
 * (root / forced rotation / normal user)
 */
export const changePassword = async (
  payload: ChangePasswordRequest
): Promise<void> => {
  const response = await fetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Сессия истекла, войдите заново");
    }
    if (response.status === 403) {
      throw new Error("Требуется смена пароля");
    }
    throw new Error(`Ошибка смены пароля (${response.status})`);
  }

  await parseApiResponse(response);

  // ✅ Пароль успешно сменён — снимаем ограничение
  localStorage.removeItem(NEEDS_PWD_CHANGE_KEY);
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
  });

  clearToken();
  localStorage.removeItem(NEEDS_PWD_CHANGE_KEY);
};
