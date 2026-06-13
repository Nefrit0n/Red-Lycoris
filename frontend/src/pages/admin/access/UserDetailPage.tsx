import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { fetchAdminUser, activateUser, deactivateUser } from "@/api/admin-users";
import type { AdminUser } from "@/api/admin-users";
import { apiGet } from "@/api/client";
import { useCurrentUser } from "@/api/auth";
import type { AuditEntry } from "@/api/audit";

import { AvatarInitials } from "@/components/admin/access/AvatarInitials";
import { RoleBadge } from "@/components/admin/access/RoleBadge";
import { UserStatusBadge } from "@/components/admin/access/UserStatusBadge";
import { MfaCell } from "@/components/admin/access/MfaCell";
import { SourceBadge } from "@/components/admin/access/SourceBadge";
import { ResetPasswordDialog } from "@/components/admin/access/ResetPasswordDialog";
import { ConfirmDestructiveActionModal } from "@/components/admin/ConfirmDestructiveActionModal";
import { useUserActionsAvailability } from "@/hooks/admin/useUserActionsAvailability";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const DUMMY_USER: AdminUser = {
  id: "",
  email: "",
  display_name: "",
  status: "active",
  is_system_account: false,
  role: { key: "member", name: "Участник" },
  groups: [],
  mfa_enabled: false,
  identity_kind: "local",
  last_login_at: null,
  last_login_ip: null,
  created_at: new Date().toISOString(),
  must_change_password: false,
};

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
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

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "dd.MM.yyyy HH:mm");
  } catch {
    return iso;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="text-foreground min-w-0">{children}</span>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const [showReset, setShowReset] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  const userQuery = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => fetchAdminUser(id!),
    enabled: !!id,
  });

  const auditQuery = useQuery({
    queryKey: ["user-audit", id],
    queryFn: () =>
      apiGet<{ data: AuditEntry[]; meta: { has_more: boolean } }>(
        "/api/v1/admin/audit",
        { resource_type: "user", resource_id: id!, limit: "15", grouped: "false" }
      ),
    enabled: !!id,
  });

  const deactivateMutation = useMutation({
    mutationFn: (reason: string) => deactivateUser(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowDeactivate(false);
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => activateUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const user = userQuery.data?.data;
  const availability = useUserActionsAvailability(user ?? DUMMY_USER, currentUser, 2);
  const isSelf = !!currentUser && !!user && currentUser.id === user.id;

  if (userQuery.isLoading) {
    return <PageSkeleton id={id} />;
  }

  if (!user || userQuery.isError) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <PageHeader id={id} />
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-base font-medium">Пользователь не найден</p>
          <Link
            to="/admin/access/users"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            ← К списку пользователей
          </Link>
        </div>
      </div>
    );
  }

  const auditEntries = auditQuery.data?.data ?? [];
  const auditHasMore = auditQuery.data?.meta?.has_more ?? false;

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader id={id} user={user} />

      <div className="flex-1 min-h-0 overflow-y-auto themed-scrollbar px-6 py-5 space-y-4">

        {/* Identity + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Identity card */}
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Идентификация
            </h2>

            <div className="flex items-center gap-3">
              <AvatarInitials
                id={user.id}
                email={user.email}
                displayName={user.display_name || undefined}
                size={40}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.display_name || <span className="text-muted-foreground">Имя не указано</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {isSelf && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 shrink-0">
                  вы
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-xs border-t border-border pt-3">
              <Row label="Источник идентичности">
                <SourceBadge kind={user.identity_kind} />
              </Row>
              <Row label="Создан">{formatDate(user.created_at)}</Row>
              <Row label="Последний вход">
                {user.last_login_at ? (
                  <span title={formatDate(user.last_login_at)}>
                    {relativeTime(user.last_login_at)}
                    {user.last_login_ip && (
                      <span className="ml-1 text-muted-foreground font-mono">
                        ({user.last_login_ip})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Никогда</span>
                )}
              </Row>
              {user.is_system_account && (
                <Row label="Тип учётной записи">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    системная
                  </Badge>
                </Row>
              )}
            </div>
          </section>

          {/* Status card */}
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Статус и доступ
            </h2>

            <div className="space-y-1 text-xs">
              <Row label="Глобальная роль">
                <RoleBadge role={user.role} />
              </Row>
              <Row label="Статус аккаунта">
                <UserStatusBadge status={user.status} />
              </Row>
              <Row label="MFA">
                <MfaCell
                  mfaEnabled={user.mfa_enabled}
                  isSystemAccount={user.is_system_account}
                />
              </Row>
              <Row label="Смена пароля">
                {user.must_change_password ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      color: "var(--status-pending-dot)",
                      borderColor: "var(--status-pending-dot)",
                    }}
                  >
                    требуется
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">не требуется</span>
                )}
              </Row>
            </div>
          </section>
        </div>

        {/* Actions — hidden for self and system */}
        {!isSelf && !user.is_system_account && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Действия
            </h2>
            <div className="flex flex-wrap gap-2">
              {availability.canResetPassword && (
                <Button size="sm" variant="outline" onClick={() => setShowReset(true)}>
                  Сбросить пароль
                </Button>
              )}
              {availability.canDeactivate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDeactivate(true)}
                >
                  Деактивировать
                </Button>
              )}
              {availability.canActivate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                >
                  {activateMutation.isPending ? "Активация…" : "Активировать"}
                </Button>
              )}
            </div>
            {activateMutation.isError && (
              <p className="text-xs text-destructive">
                {(activateMutation.error as Error)?.message ?? "Не удалось активировать пользователя"}
              </p>
            )}
          </section>
        )}

        {/* Audit log */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Журнал действий над аккаунтом
            </h2>
            <Link
              to="/admin/audit"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Полный журнал →
            </Link>
          </div>

          {auditQuery.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}

          {!auditQuery.isLoading && auditEntries.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Записей о действиях над этим аккаунтом не найдено
            </p>
          )}

          {auditEntries.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wide text-muted-foreground">
                      Действие
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wide text-muted-foreground">
                      Исполнитель
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      Время
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-border/50">
                      <td className="px-3 py-2">
                        {entry.action ? (
                          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                            {entry.action}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {entry.method} {entry.path}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.user_email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {entry.created_at
                          ? relativeTime(entry.created_at)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditHasMore && (
                <div className="px-3 py-2 border-t border-border/50 text-[11px] text-muted-foreground text-center">
                  Показаны последние 15 записей · больше в полном журнале
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground text-center pb-2">
          Управление сессиями и API-токенами пользователя будет доступно в следующем релизе.
        </p>
      </div>

      <ResetPasswordDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        user={user}
      />
      <ConfirmDestructiveActionModal
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={(reason) => deactivateMutation.mutate(reason)}
        title="Деактивировать пользователя"
        description={`Пользователь ${user.email} будет деактивирован. Все активные сессии завершатся.`}
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}

function PageHeader({
  id,
  user,
}: {
  id?: string;
  user?: AdminUser;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <span>Администрирование</span>
        <span>/</span>
        <Link
          to="/admin/access/users"
          className="hover:text-foreground transition-colors"
        >
          Управление доступом
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-xs">
          {user?.email ?? (id ? id.slice(0, 8) + "…" : "Профиль")}
        </span>
      </nav>
      <h1 className="text-lg font-semibold">
        {user
          ? user.display_name || user.email
          : "Профиль пользователя"}
      </h1>
    </div>
  );
}

function PageSkeleton({ id }: { id?: string }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader id={id} />
      <div className="flex-1 px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}
