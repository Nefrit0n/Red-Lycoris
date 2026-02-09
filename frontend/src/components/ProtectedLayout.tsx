import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  AUTH_INVALIDATED_EVENT,
  AUTH_PASSWORD_CHANGE_REQUIRED_EVENT,
  getToken,
} from "../api/http";
import SidebarLayout from "./SidebarLayout";

const NEEDS_PWD_CHANGE_KEY = "red_lycoris_needs_pwd_change";

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
    const onPasswordChangeRequired = () => {
      navigate("/change-password", { replace: true });
    };
    window.addEventListener(AUTH_INVALIDATED_EVENT, onAuthInvalidated);
    window.addEventListener(
      AUTH_PASSWORD_CHANGE_REQUIRED_EVENT,
      onPasswordChangeRequired
    );
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, onAuthInvalidated);
      window.removeEventListener(
        AUTH_PASSWORD_CHANGE_REQUIRED_EVENT,
        onPasswordChangeRequired
      );
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
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
};

export default ProtectedLayout;
