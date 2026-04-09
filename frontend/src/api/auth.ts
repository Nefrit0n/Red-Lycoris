import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, setAuthToken } from "@/api/client";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  global_role: number;
  last_login_at?: string;
}

export async function login(email: string, password: string) {
  const res = await apiPost<{ data: { user: CurrentUser; token?: string } }>("/api/v1/auth/login", {
    email,
    password,
  });
  if (res.data.token) {
    setAuthToken(res.data.token);
  }
  return res.data.user;
}

export async function logout() {
  await apiPost<{ data: { status: string } }>("/api/v1/auth/logout", {});
  setAuthToken(null);
}

export async function me() {
  try {
    const res = await apiGet<{ data: { user: CurrentUser } }>("/api/v1/auth/me");
    return res.data.user;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: me,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
