import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/Sidebar";
import { cn } from "@/lib/utils";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/findings": "Findings",
  "/projects": "Projects",
  "/import": "Import",
  "/enrichment": "Enrichment",
};

function breadcrumbFor(pathname: string): string[] {
  if (pathname === "/") return ["Dashboard"];

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
  const crumbs = breadcrumbFor(pathname);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

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

          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search..."
              className="h-8 border-zinc-800 bg-zinc-900 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-violet-600/40"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
