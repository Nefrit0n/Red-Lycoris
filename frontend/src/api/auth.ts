import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from "../types/auth";
import {
  clearToken,
  getJsonHeaders,
  getAuthHeaders,
  setToken,
  parseApiResponse,
} from "./http";

const NEEDS_PWD_CHANGE_KEY = "lotus_warden_needs_pwd_change";

/**
 * Login
 */
export const login = async (
  payload: LoginRequest
): Promise<LoginResponse> => {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Неверный логин или пароль");
    }
    if (response.status === 403) {
      throw new Error("Доступ запрещён");
    }
    throw new Error(`Ошибка входа (${response.status})`);
  }

  // parseApiResponse уже разворачивает { success, data }
  const result = await parseApiResponse<LoginResponse>(response);

  // Явная проверка контракта (fail-fast)
  if (!result.token) {
    throw new Error("Ответ сервера не содержит токен авторизации");
  }

  setToken(result.token);

  localStorage.setItem(
    NEEDS_PWD_CHANGE_KEY,
    String(result.needsPasswordChange)
  );

  return result;
};

/**
 * Change password
 */
export const changePassword = async (
  payload: ChangePasswordRequest
): Promise<void> => {
  const response = await fetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Сессия истекла");
    }
    if (response.status === 403) {
      throw new Error("Требуется смена пароля");
    }
    throw new Error(`Ошибка смены пароля (${response.status})`);
  }

  await parseApiResponse(response);
  localStorage.removeItem(NEEDS_PWD_CHANGE_KEY);
};

/**
 * Logout
 */
export const logout = async (): Promise<void> => {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: getAuthHeaders(),
  });

  clearToken();
  localStorage.removeItem(NEEDS_PWD_CHANGE_KEY);
};
