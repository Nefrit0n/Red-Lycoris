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
const USER_PROFILE_KEY = "lotus_warden_user_profile";

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
    String(result.mustChangePassword)
  );
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(result.user));

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

  const result = await parseApiResponse<{ token?: string }>(response);
  if (result?.token) {
    setToken(result.token);
  }
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
  localStorage.removeItem(USER_PROFILE_KEY);
};

export const getCurrentUser = (): UserProfile | null => {
  const raw = localStorage.getItem(USER_PROFILE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
};
