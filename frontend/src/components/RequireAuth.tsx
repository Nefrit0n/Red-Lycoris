import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/api/auth";

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
      <Loader2 className="mr-2 size-5 animate-spin" /> Загрузка...
    </div>
  );
}

export default function RequireAuth() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
