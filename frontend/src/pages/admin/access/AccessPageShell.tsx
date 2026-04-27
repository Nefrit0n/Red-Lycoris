import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAccessCounts } from "@/api/admin-users";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
}

const TABS = [
  { label: "Пользователи", path: "/admin/access/users", key: "users" as const },
  { label: "Группы", path: "/admin/access/groups", key: "groups" as const },
  { label: "Роли", path: "/admin/access/roles", key: "roles" as const },
];

export function AccessPageShell({ children }: Props) {
  const { pathname } = useLocation();

  const countsQuery = useQuery({
    queryKey: ["admin-access-counts"],
    queryFn: fetchAccessCounts,
    staleTime: 60_000,
  });
  const counts = countsQuery.data?.data;

  const activeKey = TABS.find((t) => pathname.startsWith(t.path))?.key ?? "users";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-0">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <span>Администрирование</span>
          <span>/</span>
          <span className="text-foreground font-medium">Управление доступом</span>
        </nav>

        <h1 className="text-lg font-semibold mb-4">Управление доступом</h1>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const isActive = activeKey === tab.key;
            const count =
              tab.key === "users"
                ? counts?.users
                : tab.key === "groups"
                ? counts?.groups
                : counts?.roles;
            return (
              <Link
                key={tab.key}
                to={tab.path}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors select-none",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-medium",
                      isActive
                        ? "bg-foreground/10 text-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto themed-scrollbar px-6 py-5">
        {children}
      </div>
    </div>
  );
}
