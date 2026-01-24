import { CssBaseline } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedLayout from "./components/ProtectedLayout";
import { ThemeContextProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";

import Dashboard from "./pages/Dashboard";
import FindingDetailPage from "./pages/FindingDetail";
import FindingsList from "./pages/FindingsList";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import LoginPage from "./pages/LoginPage";
import ScanUploadPage from "./pages/ScanUploadPage";
import ImportJobsList from "./pages/ImportJobsList";
import ImportJobDetail from "./pages/ImportJobDetail";
import ProductsList from "./pages/ProductsList";
import ProductDetailPage from "./pages/ProductDetail";
import AdminOverview from "./pages/AdminOverview";
import AnalyzeJobsPage from "./pages/AnalyzeJobsPage";
import AnalysisJobDetail from "./pages/AnalysisJobDetail";

import AdminAuditLogPage from "./pages/admin/AdminAuditLogPage";
import AdminGroupsPage from "./pages/admin/AdminGroupsPage";
import AdminPoliciesPage from "./pages/admin/AdminPoliciesPage";
import AdminScannersPage from "./pages/admin/AdminScannersPage";
import AdminSetupPage from "./pages/admin/AdminSetupPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminWebhooksPage from "./pages/admin/AdminWebhooksPage";

const App = () => {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />

              {/* Dashboard - главная страница */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Каноничный список находок */}
              <Route path="/findings" element={<FindingsList />} />
              <Route path="/findings/:id" element={<FindingDetailPage />} />

              <Route path="/scans/upload" element={<ScanUploadPage />} />
              <Route path="/imports" element={<ImportJobsList />} />
              <Route path="/imports/:id" element={<ImportJobDetail />} />
              <Route path="/products" element={<ProductsList />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/analyze" element={<AnalyzeJobsPage />} />
              <Route path="/analyze/:id" element={<AnalysisJobDetail />} />

              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/groups" element={<AdminGroupsPage />} />
              <Route path="/admin/policies" element={<AdminPoliciesPage />} />
              <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
              <Route path="/admin/webhooks" element={<AdminWebhooksPage />} />
              <Route path="/admin/scanners" element={<AdminScannersPage />} />
              <Route path="/admin/setup" element={<AdminSetupPage />} />

              {/* Редиректы */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeContextProvider>
  );
};

export default App;
