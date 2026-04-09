import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/api/auth";
import { apiGet, apiPatch, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  global_role: number;
  last_login_at?: string;
}

export default function AdminUsers() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] = useState<AdminUser | null>(null);
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", is_admin: false });
  const [newPassword, setNewPassword] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiGet<{ data: AdminUser[]; meta: { total: number } }>("/api/v1/admin/users");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost("/api/v1/admin/users", createForm),
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateForm({ email: "", password: "", full_name: "", is_admin: false });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const patchUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => apiPatch(`/api/v1/admin/users/${id}`, payload),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiPost(`/api/v1/admin/users/${id}/reset-password`, { new_password: password }),
    onSuccess: () => {
      setPasswordDialogUser(null);
      setNewPassword("");
    },
  });

  if (!currentUser) return null;
  if (currentUser.global_role !== 1) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Пользователи</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>Создать пользователя</Button>
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
              {(usersQuery.data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-zinc-800">
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.full_name || "—"}</td>
                  <td className="py-2">
                    <Badge>{u.global_role === 1 ? "Админ" : "Пользователь"}</Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant={u.is_active ? "default" : "secondary"}>
                      {u.is_active ? "Активен" : "Отключен"}
                    </Badge>
                  </td>
                  <td className="py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="py-2 space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setPasswordDialogUser(u)}>Сменить пароль</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patchUser.mutate({ id: u.id, payload: { is_admin: u.global_role !== 1 } })}
                    >
                      {u.global_role === 1 ? "Убрать админа" : "Сделать админом"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patchUser.mutate({ id: u.id, payload: { is_active: !u.is_active } })}
                    >
                      {u.is_active ? "Деактивировать" : "Активировать"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Создать пользователя</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            <Input placeholder="Пароль" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            <Input placeholder="ФИО" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createForm.is_admin} onChange={(e) => setCreateForm({ ...createForm, is_admin: e.target.checked })} />
              Администратор
            </label>
            <Button className="w-full" onClick={() => createMutation.mutate()}>Создать</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordDialogUser)} onOpenChange={(open) => !open && setPasswordDialogUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Сменить пароль</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Новый пароль" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button
              className="w-full"
              onClick={() => {
                if (!passwordDialogUser) return;
                resetPassword.mutate({ id: passwordDialogUser.id, password: newPassword });
              }}
            >
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
