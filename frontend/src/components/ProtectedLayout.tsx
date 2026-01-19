import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "../api/http";
import AppShell from "./AppShell";

const NEEDS_PWD_CHANGE_KEY = "lotus_warden_needs_pwd_change";

const ProtectedLayout = () => {
  const token = getToken();
  const location = useLocation();

  const needsPasswordChange =
    localStorage.getItem(NEEDS_PWD_CHANGE_KEY) === "true";

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
