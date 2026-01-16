import { CssBaseline } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedLayout from "./components/ProtectedLayout";
import FindingDetailPage from "./pages/FindingDetail";
import FindingsList from "./pages/FindingsList";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import LoginPage from "./pages/LoginPage";
import ScanUploadPage from "./pages/ScanUploadPage";

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
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
