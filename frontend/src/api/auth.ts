import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UserProfile,
} from "../types/auth";
import {
  clearToken,
  setToken,
} from "./http";
import { ApiError, request } from "./client";

const NEEDS_PWD_CHANGE_KEY = "red_lycoris_needs_pwd_change";
const USER_PROFILE_KEY = "red_lycoris_user_profile";

/**
 * Login
 */
export const login = async (
  payload: LoginRequest
): Promise<LoginResponse> => {
  let result: LoginResponse;
  try {
    result = await request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: payload,
      json: true,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new Error("Неверный логин или пароль");
      }
      if (error.status === 403) {
        throw new Error("Доступ запрещён");
      }
      throw new Error(`Ошибка входа (${error.status})`);
    }
    throw error;
  }

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
  let result: { token?: string };
  try {
    result = await request<{ token?: string }>("/api/v1/auth/change-password", {
      method: "POST",
      body: payload,
      json: true,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new Error("Сессия истекла");
      }
      if (error.status === 403) {
        throw new Error("Требуется смена пароля");
      }
      throw new Error(`Ошибка смены пароля (${error.status})`);
    }
    throw error;
  }
  if (result?.token) {
    setToken(result.token);
  }
  localStorage.removeItem(NEEDS_PWD_CHANGE_KEY);
};

/**
 * Logout
 */
export const logout = async (): Promise<void> => {
  await request<void>("/api/v1/auth/logout", {
    method: "POST",
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

export const isAdminUser = (user: UserProfile | null): boolean =>
  Boolean(
    user?.roles?.includes("admin") ||
      user?.roles?.includes("superuser")
  );
