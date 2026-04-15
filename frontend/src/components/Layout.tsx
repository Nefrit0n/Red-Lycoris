import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/Sidebar";
import { useCurrentUser, logout } from "@/api/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const routeTitles: Record<string, string> = {
  "/": "Дашборд",
  "/findings": "Находки",
  "/projects": "Проекты",
  "/import": "Импорт",
  "/enrichment": "Обогащение",
};

function breadcrumbFor(pathname: string): string[] {
  if (pathname === "/") return ["Дашборд"];

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: string[] = [];

  const base = `/${segments[0]}`;
  crumbs.push(routeTitles[base] ?? segments[0]);

  if (segments.length > 1) {
    crumbs.push(segments.slice(1).join("/"));
  }

  return crumbs;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { data: user } = useCurrentUser();
  const crumbs = breadcrumbFor(pathname);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        isAdmin={user?.global_role === 1}
      />

      <div
        className={cn(
          "flex flex-1 flex-col transition-[margin] duration-200",
          collapsed ? "ml-16" : "ml-60",
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur">
          <nav className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-600">/</span>}
                <span
                  className={
                    i === crumbs.length - 1
                      ? "font-medium text-zinc-100"
                      : "text-zinc-500"
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Поиск..."
                className="h-8 border-zinc-800 bg-zinc-900 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-red-700/40"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md border border-zinc-800 px-2 py-1 text-sm text-zinc-200">
                {user?.email ?? "Профиль"}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem disabled>
                  <span>Настройки</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                >
                  Выйти
                </DropdownMenuItem>
                {user?.global_role === 1 && (
                  <>
                    <DropdownMenuItem>
                      <Link to="/admin/users">Админка</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/admin/audit">Аудит</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
