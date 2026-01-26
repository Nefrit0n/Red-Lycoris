import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AUTH_INVALIDATED_EVENT, getToken } from "../api/http";
import AppShell from "./AppShell";

const NEEDS_PWD_CHANGE_KEY = "lotus_warden_needs_pwd_change";

const ProtectedLayout = () => {
  const token = getToken();
  const location = useLocation();
  const navigate = useNavigate();

  const needsPasswordChange =
    localStorage.getItem(NEEDS_PWD_CHANGE_KEY) === "true";

  // If request layer invalidates auth (401), we must redirect explicitly.
  // localStorage changes won't trigger rerenders in the same tab.
  useEffect(() => {
    const onAuthInvalidated = () => {
      navigate("/login", {
        replace: true,
        state: { from: `${location.pathname}${location.search}` },
      });
    };
    window.addEventListener(AUTH_INVALIDATED_EVENT, onAuthInvalidated);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, onAuthInvalidated);
    };
  }, [navigate, location.pathname, location.search]);

  // 1️⃣ Нет токена → логин
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2️⃣ Нужно сменить пароль → только /change-password разрешён
  if (
    needsPasswordChange &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default ProtectedLayout;
