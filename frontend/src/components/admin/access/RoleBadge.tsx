import { cn } from "@/lib/utils";
import type { RoleRef } from "@/api/admin-users";

const ROLE_STYLES: Record<string, { bg: string; fg: string; icon?: string }> = {
  admin:   { bg: "var(--role-admin-bg)",   fg: "var(--role-admin-fg)",   icon: "◈" },
  auditor: { bg: "var(--role-auditor-bg)", fg: "var(--role-auditor-fg)", icon: "⊕" },
  member:  { bg: "var(--role-member-bg)",  fg: "var(--role-member-fg)" },
  viewer:  { bg: "var(--role-viewer-bg)",  fg: "var(--role-viewer-fg)" },
};

interface Props {
  role: RoleRef;
  className?: string;
}

export function RoleBadge({ role, className }: Props) {
  const style = ROLE_STYLES[role.key] ?? ROLE_STYLES.viewer;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap select-none",
        className
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.icon && <span aria-hidden className="text-[10px]">{style.icon}</span>}
      {role.name}
    </span>
  );
}
