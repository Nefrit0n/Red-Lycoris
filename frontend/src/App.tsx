import { lazy, Suspense } from "react";
import { CircularProgress, CssBaseline, Box } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedLayout from "./components/ProtectedLayout";
import { ThemeContextProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";

// Eager-loaded: login is the entry point, always needed immediately.
import LoginPage from "./pages/LoginPage";

// Lazy-loaded route pages — split into separate chunks.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FindingDetailPage = lazy(() => import("./pages/FindingDetailPage"));
const FindingsList = lazy(() => import("./pages/FindingsPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const ScanUploadPage = lazy(() => import("./pages/ScanUploadPage"));
const ImportJobsList = lazy(() => import("./pages/ImportJobsList"));
const ImportJobDetail = lazy(() => import("./pages/ImportJobDetail"));
const ProductsList = lazy(() => import("./pages/ProductsList"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetail"));
const AnalyzeJobsPage = lazy(() => import("./pages/AnalyzeJobsPage"));
const AnalysisJobDetail = lazy(() => import("./pages/AnalysisJobDetail"));
const RunsPage = lazy(() => import("./pages/RunsPage"));

const OverviewPage = lazy(() => import("./admin-v2/pages/OverviewPage"));
const UsersPage = lazy(() => import("./admin-v2/pages/UsersPage"));
const TeamsPage = lazy(() => import("./admin-v2/pages/TeamsPage"));
const ProjectsPage = lazy(() => import("./admin-v2/pages/ProjectsPage"));
const PoliciesPage = lazy(() => import("./admin-v2/pages/PoliciesPage"));
const AuditPage = lazy(() => import("./admin-v2/pages/AuditPage"));
const IntegrationTokensPage = lazy(
  () => import("./admin-v2/pages/IntegrationTokensPage"),
);

const PageLoader = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="60vh"
  >
    <CircularProgress />
  </Box>
);

const App = () => {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <NotificationProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedLayout />}>
                <Route
                  path="/change-password"
                  element={<ChangePasswordPage />}
                />

                {/* Dashboard - главная страница */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Каноничный список находок */}
                <Route path="/findings" element={<FindingsList />} />
                <Route path="/findings/:id" element={<FindingDetailPage />} />

                <Route path="/scans/upload" element={<ScanUploadPage />} />
                <Route path="/imports" element={<ImportJobsList />} />
                <Route path="/imports/:id" element={<ImportJobDetail />} />
                <Route path="/products" element={<ProductsList />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/runs" element={<RunsPage />} />
                <Route path="/runs/:id" element={<AnalysisJobDetail />} />
                {/* Legacy routes — redirect to new runs-first UI */}
                <Route path="/analyze" element={<Navigate to="/runs" replace />} />
                <Route path="/analyze/:id" element={<AnalysisJobDetail />} />

                <Route path="/admin" element={<OverviewPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/teams" element={<TeamsPage />} />
                <Route path="/admin/projects" element={<ProjectsPage />} />
                <Route path="/admin/policies" element={<PoliciesPage />} />
                <Route
                  path="/admin/integrations/tokens"
                  element={<IntegrationTokensPage />}
                />
                <Route
                  path="/admin/integrations/tokens/:id"
                  element={<IntegrationTokensPage />}
                />
                <Route path="/admin/audit" element={<AuditPage />} />

                {/* Catch-all */}
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeContextProvider>
  );
};

export default App;
