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
import AnalyzeJobsPage from "./pages/AnalyzeJobsPage";
import AnalysisJobDetail from "./pages/AnalysisJobDetail";

import OverviewPage from "./admin-v2/pages/OverviewPage";
import UsersPage from "./admin-v2/pages/UsersPage";
import TeamsPage from "./admin-v2/pages/TeamsPage";
import ProjectsPage from "./admin-v2/pages/ProjectsPage";
import PoliciesPage from "./admin-v2/pages/PoliciesPage";
import AuditPage from "./admin-v2/pages/AuditPage";

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

              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/teams" element={<TeamsPage />} />
              <Route path="/admin/projects" element={<ProjectsPage />} />
              <Route path="/admin/policies" element={<PoliciesPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />

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
