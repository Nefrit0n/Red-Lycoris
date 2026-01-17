import { CssBaseline } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedLayout from "./components/ProtectedLayout";

import FindingDetailPage from "./pages/FindingDetail";
import FindingsList from "./pages/FindingsList";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import LoginPage from "./pages/LoginPage";
import ScanUploadPage from "./pages/ScanUploadPage";
import ImportJobsList from "./pages/ImportJobsList";
import ImportJobDetail from "./pages/ImportJobDetail";
import ProductsList from "./pages/ProductsList";
import AdminOverview from "./pages/AdminOverview";
import AnalyzeJobsPage from "./pages/AnalyzeJobsPage";
import AnalysisJobDetail from "./pages/AnalysisJobDetail";

import AdminAuditLogPage from "./pages/admin/AdminAuditLogPage";
import AdminGroupsPage from "./pages/admin/AdminGroupsPage";
import AdminScannersPage from "./pages/admin/AdminScannersPage";
import AdminSetupPage from "./pages/admin/AdminSetupPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminWebhooksPage from "./pages/admin/AdminWebhooksPage";

const App = () => {
  return (
    <BrowserRouter>
      <CssBaseline />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Каноничный список находок */}
          <Route path="/findings" element={<FindingsList />} />
          <Route path="/findings/:id" element={<FindingDetailPage />} />

          <Route path="/scans/upload" element={<ScanUploadPage />} />
          <Route path="/imports" element={<ImportJobsList />} />
          <Route path="/imports/:id" element={<ImportJobDetail />} />
          <Route path="/products" element={<ProductsList />} />
          <Route path="/analyze" element={<AnalyzeJobsPage />} />
          <Route path="/analyze/:id" element={<AnalysisJobDetail />} />

          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/groups" element={<AdminGroupsPage />} />
          <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
          <Route path="/admin/webhooks" element={<AdminWebhooksPage />} />
          <Route path="/admin/scanners" element={<AdminScannersPage />} />
          <Route path="/admin/setup" element={<AdminSetupPage />} />

          {/* Редиректы со старых/алиасов */}
          <Route path="/dashboard" element={<Navigate to="/findings" replace />} />
          <Route path="/" element={<Navigate to="/findings" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/findings" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
