import type { AdminUser } from "@/api/admin-users";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours}ч назад`;
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`;
  return `${Math.floor(diffDays / 365)} лет назад`;
}

function isDormant(dateStr: string | null): boolean {
  if (!dateStr) return true;
  const diffDays = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
  return diffDays > 90;
}

interface Props {
  user: AdminUser;
}

export function LastLoginCell({ user }: Props) {
  const dormant = isDormant(user.last_login_at);

  if (!user.last_login_at) {
    const createdDaysAgo = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / 86_400_000
    );
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">никогда</span>
        <span className="text-[10px] text-muted-foreground/60">
          создан {createdDaysAgo === 0 ? "сегодня" : `${createdDaysAgo} дн. назад`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-xs"
        style={{ color: dormant ? "var(--status-pending-dot)" : undefined }}
      >
        {dormant ? "dormant · " : ""}
        {relativeTime(user.last_login_at)}
      </span>
      {user.last_login_ip && (
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {user.last_login_ip}
        </span>
      )}
    </div>
  );
}
