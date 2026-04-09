import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import Dashboard from "@/pages/Dashboard";
import FindingsList from "@/pages/FindingsList";
import FindingDetail from "@/pages/FindingDetail";
import ProjectsList from "@/pages/ProjectsList";
import ProjectDetail from "@/pages/ProjectDetail";
import Import from "@/pages/Import";
import EnrichmentStatus from "@/pages/EnrichmentStatus";
import Login from "@/pages/Login";
import AdminUsers from "@/pages/AdminUsers";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/findings" element={<FindingsList />} />
            <Route path="/findings/:id" element={<FindingDetail />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/import" element={<Import />} />
            <Route path="/enrichment" element={<EnrichmentStatus />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
