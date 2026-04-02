import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import FindingsList from "@/pages/FindingsList";
import FindingDetail from "@/pages/FindingDetail";
import ProjectsList from "@/pages/ProjectsList";
import Import from "@/pages/Import";
import EnrichmentStatus from "@/pages/EnrichmentStatus";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/findings" element={<FindingsList />} />
        <Route path="/findings/:id" element={<FindingDetail />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/import" element={<Import />} />
        <Route path="/enrichment" element={<EnrichmentStatus />} />
      </Routes>
    </BrowserRouter>
  );
}
