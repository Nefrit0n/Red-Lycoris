import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import ChangePassword from "@/pages/ChangePassword";
import AdminUsers from "@/pages/AdminUsers";
import AdminAudit from "@/pages/AdminAudit";
import { AccessPageShell } from "@/pages/admin/access/AccessPageShell";
import UsersListView from "@/pages/admin/access/UsersListView";
import UserDetailPage from "@/pages/admin/access/UserDetailPage";
import GroupsPlaceholder from "@/pages/admin/access/GroupsPlaceholder";
import RolesPlaceholder from "@/pages/admin/access/RolesPlaceholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/change-password" element={<ChangePassword />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/findings" element={<FindingsList />} />
            <Route path="/findings/:id" element={<FindingDetail />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/import" element={<Import />} />
            <Route path="/enrichment" element={<EnrichmentStatus />} />

            {/* Old URL → redirect */}
            <Route path="/admin/users" element={<AdminUsers />} />

            <Route path="/admin/audit" element={<AdminAudit />} />

            {/* New /admin/access/* section */}
            <Route
              path="/admin/access"
              element={<Navigate to="/admin/access/users" replace />}
            />
            <Route
              path="/admin/access/users"
              element={
                <AccessPageShell>
                  <UsersListView />
                </AccessPageShell>
              }
            />
            <Route
              path="/admin/access/users/:id"
              element={<UserDetailPage />}
            />
            <Route
              path="/admin/access/groups"
              element={
                <AccessPageShell>
                  <GroupsPlaceholder />
                </AccessPageShell>
              }
            />
            <Route
              path="/admin/access/roles"
              element={
                <AccessPageShell>
                  <RolesPlaceholder />
                </AccessPageShell>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
