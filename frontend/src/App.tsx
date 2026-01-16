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

const App = () => {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<FindingsList />} />
          <Route path="/findings" element={<FindingsList />} />
          <Route path="/findings/:id" element={<FindingDetailPage />} />
          <Route path="/scans/upload" element={<ScanUploadPage />} />
          <Route path="/imports" element={<ImportJobsList />} />
          <Route path="/imports/:id" element={<ImportJobDetail />} />
          <Route path="/products" element={<ProductsList />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
