import { useEffect, useState } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
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
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLoadingTooLong(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoadingTooLong(true);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoading]);

  if (isLoading) {
    if (!loadingTooLong) return <FullScreenSpinner />;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-200">
        <div className="flex items-center text-sm text-zinc-300">
          <Loader2 className="mr-2 size-5 animate-spin" /> Проверяем сессию...
        </div>
        <p className="max-w-lg text-center text-sm text-zinc-400">
          Загрузка длится слишком долго. Обычно это означает, что фронтенд не может получить ответ от
          <code className="mx-1 rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">/api/v1/auth/me</code>.
        </p>
        <div className="flex gap-2">
          <a
            href="/api/v1/auth/me"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Открыть /api/v1/auth/me
          </a>
          <Link
            to="/login"
            replace
            className="rounded-md bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600"
          >
            Перейти к входу
          </Link>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
