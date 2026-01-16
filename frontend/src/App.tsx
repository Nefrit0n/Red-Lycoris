import { CssBaseline } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import FindingDetailPage from "./pages/FindingDetail";
import FindingsList from "./pages/FindingsList";

const App = () => {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Routes>
        <Route path="/findings" element={<FindingsList />} />
        <Route path="/findings/:id" element={<FindingDetailPage />} />
        <Route path="/" element={<Navigate to="/findings" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
