// Old /admin/users — redirects to the new /admin/access/users page (301-equivalent).
import { Navigate } from "react-router-dom";

export default function AdminUsers() {
  return <Navigate to="/admin/access/users" replace />;
}
