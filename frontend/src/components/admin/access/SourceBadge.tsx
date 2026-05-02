import { cn } from "@/lib/utils";
import type { AdminUser } from "@/api/admin-users";

const SOURCE_LABELS: Record<AdminUser["identity_kind"], string> = {
  local: "local",
  ldap: "LDAP",
  ad: "AD",
  oidc: "OIDC",
};

interface Props {
  kind: AdminUser["identity_kind"];
  className?: string;
}

export function SourceBadge({ kind, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-px text-[10px] font-mono font-medium border select-none whitespace-nowrap",
        kind === "local"
          ? "border-border/60 text-muted-foreground bg-muted/40"
          : "border-blue-300/60 text-blue-600 bg-blue-50 dark:border-blue-700/50 dark:text-blue-400 dark:bg-blue-900/20",
        className
      )}
    >
      {SOURCE_LABELS[kind] ?? kind}
    </span>
  );
}
