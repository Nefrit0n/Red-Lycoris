import { cn } from "@/lib/utils";
import type { AdminUser } from "@/api/admin-users";

const STATUS_CONFIG: Record<
  AdminUser["status"],
  { label: string; bg: string; fg: string; dot: string }
> = {
  active: {
    label: "Активен",
    bg: "var(--status-active-bg)",
    fg: "var(--status-active-fg)",
    dot: "var(--status-active-dot)",
  },
  pending: {
    label: "Ожидает",
    bg: "var(--status-pending-bg)",
    fg: "var(--status-pending-fg)",
    dot: "var(--status-pending-dot)",
  },
  disabled: {
    label: "Деактивирован",
    bg: "var(--status-disabled-bg)",
    fg: "var(--status-disabled-fg)",
    dot: "var(--status-disabled-dot)",
  },
};

interface Props {
  status: AdminUser["status"];
  className?: string;
}

export function UserStatusBadge({ status, className }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disabled;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap select-none",
        className
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.dot }}
        aria-hidden
      />
      {cfg.label}
    </span>
  );
}
