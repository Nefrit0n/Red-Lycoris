import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/api/auth";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_system_account: boolean;
  global_role: number;
  status: "active" | "pending" | "disabled";
  last_login_at?: string;
}

// Возвращает причину, по которой действие недоступно, или null если доступно.
function getDisabledReason(
  row: AdminUser,
  currentUserId: string,
  activeAdminCount: number,
  action: "deactivate" | "resetPassword" | "removeAdmin" | "delete"
): string | null {
  if (row.id === currentUserId) {
    return "Нельзя применить к собственной учётной записи";
  }
  if (row.is_system_account && action !== "resetPassword") {
    return "Системная учётная запись защищена";
  }
  if (
    (action === "removeAdmin" || action === "deactivate") &&
    row.global_role === 1 &&
    activeAdminCount <= 1
  ) {
    return "Нельзя оставить систему без активных администраторов";
  }
  return null;
}

interface ConfirmAction {
  type: "deactivate" | "activate" | "removeAdmin" | "makeAdmin" | "delete" | "resetPassword";
  user: AdminUser;
}

export default function AdminUsers() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", is_admin: false });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiGet<{ data: AdminUser[]; meta: { total: number } }>("/api/v1/admin/users");
      return res.data;
    },
  });

  const activeAdminCount = (usersQuery.data ?? []).filter(
    (u) => u.global_role === 1 && u.is_active
  ).length;

  const createMutation = useMutation({
    mutationFn: () => apiPost("/api/v1/admin/users", createForm),
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateForm({ email: "", password: "", full_name: "", is_admin: false });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      apiPatch(`/api/v1/admin/users/${id}/role`, { is_admin: isAdmin }),
    onSuccess: async () => {
      setConfirmAction(null);
      setConfirmReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/admin/users/${id}/deactivate`, {}),
    onSuccess: async () => {
      setConfirmAction(null);
      setConfirmReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/admin/users/${id}/activate`, {}),
    onSuccess: async () => {
      setConfirmAction(null);
      setConfirmReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/admin/users/${id}`),
    onSuccess: async () => {
      setConfirmAction(null);
      setConfirmReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiPost(`/api/v1/admin/users/${id}/reset-password`, { new_password: password }),
    onSuccess: () => {
      setPasswordResetUser(null);
      setNewPassword("");
    },
  });

  if (!currentUser) return null;
  if (currentUser.global_role !== 1) return <Navigate to="/" replace />;

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    if (type === "deactivate") deactivateMutation.mutate(user.id);
    else if (type === "activate") activateMutation.mutate(user.id);
    else if (type === "delete") deleteMutation.mutate(user.id);
    else if (type === "removeAdmin") changeRoleMutation.mutate({ id: user.id, isAdmin: false });
    else if (type === "makeAdmin") changeRoleMutation.mutate({ id: user.id, isAdmin: true });
  };

  const confirmLabels: Record<ConfirmAction["type"], string> = {
    deactivate: "Деактивировать",
    activate: "Активировать",
    delete: "Удалить",
    removeAdmin: "Убрать права администратора",
    makeAdmin: "Назначить администратором",
    resetPassword: "Сбросить пароль",
  };

  const confirmDescriptions: Record<ConfirmAction["type"], string> = {
    deactivate: "Пользователь потеряет доступ к системе. Все активные сессии будут завершены.",
    activate: "Пользователь снова получит доступ к системе.",
    delete: "Учётная запись будет деактивирована. Данные сохраняются для аудита.",
    removeAdmin: "Пользователь потеряет права администратора. Все активные сессии будут завершены.",
    makeAdmin: "Пользователь получит полный доступ ко всей системе.",
    resetPassword: "Пользователю будет установлен новый пароль. Все активные сессии будут завершены.",
  };

  const isDestructiveConfirm =
    confirmAction?.type === "deactivate" ||
    confirmAction?.type === "delete" ||
    confirmAction?.type === "removeAdmin";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Пользователи</CardTitle>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              Создать пользователя
            </Button>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">ФИО</th>
                  <th className="py-2 text-left">Роль</th>
                  <th className="py-2 text-left">Статус</th>
                  <th className="py-2 text-left">Последний вход</th>
                  <th className="py-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data ?? []).map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const deactivateReason = getDisabledReason(u, currentUser.id, activeAdminCount, "deactivate");
                  const removeAdminReason = getDisabledReason(u, currentUser.id, activeAdminCount, "removeAdmin");
                  const resetPasswordReason = getDisabledReason(u, currentUser.id, activeAdminCount, "resetPassword");
                  const deleteReason = getDisabledReason(u, currentUser.id, activeAdminCount, "delete");

                  return (
                    <tr key={u.id} className="border-t border-zinc-800">
                      <td className="py-2">
                        {u.email}
                        {isSelf && (
                          <Badge variant="outline" className="ml-2 text-xs">вы</Badge>
                        )}
                        {u.is_system_account && (
                          <Badge variant="outline" className="ml-2 text-xs">system</Badge>
                        )}
                      </td>
                      <td className="py-2">{u.full_name || "—"}</td>
                      <td className="py-2">
                        <Badge
                          className={
                            u.global_role === 1
                              ? "bg-purple-900 text-purple-100"
                              : "bg-zinc-700 text-zinc-100"
                          }
                        >
                          {u.global_role === 1 ? "Админ" : "Пользователь"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant={u.is_active ? "default" : "secondary"}>
                          {u.status === "pending"
                            ? "Ожидает"
                            : u.is_active
                            ? "Активен"
                            : "Отключен"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString("ru-RU") : "—"}
                      </td>
                      <td className="py-2 space-x-2">
                        {/* Сброс пароля */}
                        <ActionButton
                          label="Сбросить пароль"
                          disabledReason={resetPasswordReason}
                          onClick={() => setPasswordResetUser(u)}
                        />

                        {/* Смена роли */}
                        {u.global_role === 1 ? (
                          <ActionButton
                            label="Убрать админа"
                            disabledReason={removeAdminReason}
                            destructive
                            onClick={() => setConfirmAction({ type: "removeAdmin", user: u })}
                          />
                        ) : (
                          <ActionButton
                            label="Сделать админом"
                            disabledReason={null}
                            onClick={() => setConfirmAction({ type: "makeAdmin", user: u })}
                          />
                        )}

                        {/* Деактивация / активация */}
                        {u.is_active ? (
                          <ActionButton
                            label="Деактивировать"
                            disabledReason={deactivateReason}
                            destructive
                            onClick={() => setConfirmAction({ type: "deactivate", user: u })}
                          />
                        ) : (
                          <ActionButton
                            label="Активировать"
                            disabledReason={null}
                            onClick={() => setConfirmAction({ type: "activate", user: u })}
                          />
                        )}

                        {/* Удаление */}
                        <ActionButton
                          label="Удалить"
                          disabledReason={deleteReason}
                          destructive
                          onClick={() => setConfirmAction({ type: "delete", user: u })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Создание пользователя */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
              <Input
                placeholder="Пароль"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
              <Input
                placeholder="ФИО"
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.is_admin}
                  onChange={(e) => setCreateForm({ ...createForm, is_admin: e.target.checked })}
                />
                Администратор
              </label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button
                variant="outline"
                disabled={!createForm.email || !createForm.password || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm dialog для деструктивных и значимых действий */}
        <Dialog
          open={Boolean(confirmAction)}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmAction(null);
              setConfirmReason("");
            }
          }}
        >
          {confirmAction && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{confirmLabels[confirmAction.type]}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-zinc-300">
                <p>
                  Пользователь: <span className="font-medium text-white">{confirmAction.user.email}</span>
                </p>
                <p>{confirmDescriptions[confirmAction.type]}</p>
                {isDestructiveConfirm && (
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs">Причина (обязательно, не менее 10 символов)</label>
                    <Input
                      placeholder="Укажите причину..."
                      value={confirmReason}
                      onChange={(e) => setConfirmReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmAction(null);
                    setConfirmReason("");
                  }}
                >
                  Отмена
                </Button>
                <Button
                  variant={isDestructiveConfirm ? "destructive" : "outline"}
                  disabled={
                    (isDestructiveConfirm && confirmReason.trim().length < 10) ||
                    deactivateMutation.isPending ||
                    activateMutation.isPending ||
                    deleteMutation.isPending ||
                    changeRoleMutation.isPending
                  }
                  onClick={handleConfirm}
                >
                  {confirmLabels[confirmAction.type]}
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Сброс пароля */}
        <Dialog
          open={Boolean(passwordResetUser)}
          onOpenChange={(open) => {
            if (!open) {
              setPasswordResetUser(null);
              setNewPassword("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Сбросить пароль</DialogTitle>
            </DialogHeader>
            {passwordResetUser && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Пользователь: <span className="text-white">{passwordResetUser.email}</span>
                </p>
                <Input
                  placeholder="Новый пароль"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-zinc-500">
                  Все активные сессии пользователя будут завершены.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setPasswordResetUser(null);
                  setNewPassword("");
                }}
              >
                Отмена
              </Button>
              <Button
                variant="outline"
                disabled={!newPassword || resetPasswordMutation.isPending}
                onClick={() => {
                  if (!passwordResetUser) return;
                  resetPasswordMutation.mutate({ id: passwordResetUser.id, password: newPassword });
                }}
              >
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

interface ActionButtonProps {
  label: string;
  disabledReason: string | null;
  destructive?: boolean;
  onClick: () => void;
}

function ActionButton({ label, disabledReason, destructive, onClick }: ActionButtonProps) {
  const btn = (
    <Button
      size="sm"
      variant={destructive ? "destructive" : "outline"}
      disabled={Boolean(disabledReason)}
      onClick={onClick}
      className={destructive && !disabledReason ? "opacity-100" : ""}
    >
      {label}
    </Button>
  );

  if (!disabledReason) return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{btn}</span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}
