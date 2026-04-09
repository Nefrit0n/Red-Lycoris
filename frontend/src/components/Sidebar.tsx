import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Folder,
  Upload,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard },
  { to: "/findings", label: "Находки", icon: Search },
  { to: "/projects", label: "Проекты", icon: Folder },
  { to: "/import", label: "Импорт", icon: Upload },
  { to: "/enrichment", label: "Обогащение", icon: Database },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
}

export default function Sidebar({ collapsed, onToggle, isAdmin }: SidebarProps) {
  const items = isAdmin
    ? [...navItems, { to: "/admin/users", label: "Админка", icon: Database }]
    : navItems;
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-zinc-800 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <img src="/logo.svg" alt="Red Lycoris" className="h-6" />
        ) : (
          <img src="/logo_full.svg" alt="Red Lycoris" className="h-7" />
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-red-700/15 text-red-500"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <>
              <PanelLeftClose className="size-5" />
              <span>Свернуть</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
