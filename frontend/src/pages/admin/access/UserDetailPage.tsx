import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminUser } from "@/api/admin-users";
import { deleteUserProjectOverride, fetchUserEffectiveProjects, fetchUserSessions, putUserProjectOverride, revokeAllUserSessions, revokeUserSession } from "@/api/admin-access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TABS = [
  ["profile", "Профиль"],
  ["access", "Группы и доступы"],
  ["activity", "Активность"],
  ["sessions", "Сессии"],
  ["danger", "Опасная зона"],
] as const;

export default function UserDetailPage() {
  const { id = "" } = useParams();
  const [search, setSearch] = useSearchParams();
  const queryClient = useQueryClient();
  const tab = search.get("tab") ?? "access";

  const userQ = useQuery({ queryKey: ["admin-user", id], queryFn: () => fetchAdminUser(id), enabled: !!id });
  const accessQ = useQuery({ queryKey: ["admin-user-projects", id], queryFn: () => fetchUserEffectiveProjects(id), enabled: !!id });
  const sessionsQ = useQuery({ queryKey: ["admin-user-sessions", id], queryFn: () => fetchUserSessions(id), enabled: !!id && tab === "sessions" });

  const setOverride = useMutation({
    mutationFn: ({ pid, level }: { pid: string; level: "read" | "write" | "admin" }) => putUserProjectOverride(id, pid, level),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-projects", id] }),
  });
  const delOverride = useMutation({
    mutationFn: (pid: string) => deleteUserProjectOverride(id, pid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-projects", id] }),
  });
  const revokeOne = useMutation({
    mutationFn: (sid: string) => revokeUserSession(id, sid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-sessions", id] }),
  });
  const revokeAll = useMutation({
    mutationFn: () => revokeAllUserSessions(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-sessions", id] }),
  });

  const user = userQ.data?.data;
  const projects = accessQ.data?.data ?? [];
  const granted = useMemo(() => projects.filter((p) => p.level).length, [projects]);

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-muted-foreground"><Link to="/admin/access/users">Пользователи</Link> / Детали</div>
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{user?.display_name || user?.email}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
          <Badge>{user?.status}</Badge>
        </div>
        <div className="flex gap-2 border-b pb-2 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <Button key={k} variant={tab === k ? "default" : "ghost"} size="sm" onClick={() => setSearch({ tab: k })}>{l}</Button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>Email: {user?.email}</div><div>Статус: {user?.status}</div>
            <div>MFA: {user?.mfa_enabled ? "Да" : "Нет"}</div><div>Источник: {user?.identity_kind}</div>
            <div>Последний вход: {user?.last_login_at || "—"}</div><div>IP: {user?.last_login_ip || "—"}</div>
          </div>
        )}

        {tab === "access" && (
          <div className="grid lg:grid-cols-[1fr_1.25fr] gap-4">
            <Card className="p-3 space-y-3">
              <div className="text-sm font-semibold">Роль</div>
              <div><Badge>{user?.role?.name}</Badge></div>
              <div className="text-xs text-muted-foreground">Группы: {user?.groups?.length ?? 0}</div>
              <div className="space-y-2">
                {user?.groups?.map((g) => (
                  <div key={g.id} className="p-2 rounded border flex items-center gap-2">
                    <span className="inline-block w-1.5 h-5 rounded" style={{ background: `var(--group-${g.color_key}, #6b7280)` }} />
                    <span>{g.name}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-3 space-y-3">
              <div className="text-sm font-semibold">Доступ к проектам — {granted} из {projects.length}</div>
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.project_id} className={`grid grid-cols-[1fr_120px_1fr_120px] gap-2 items-center p-2 rounded border ${p.is_personal_override ? "bg-blue-500/10" : ""} ${!p.level ? "opacity-60" : ""}`}>
                    <div className="font-medium text-sm">{p.project_name} {p.is_personal_override && <Badge variant="secondary" className="ml-1">исключение</Badge>}</div>
                    <div>{p.level ? <Badge>{p.level}</Badge> : "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.sources.length ? p.sources.map((s) => s.name).join(" + ") : "нет доступа"}</div>
                    <div className="flex gap-1">
                      <Select onValueChange={(v) => { if (v) setOverride.mutate({ pid: p.project_id, level: v as "read"|"write"|"admin" }); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Уровень" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">read</SelectItem>
                          <SelectItem value="write">write</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {p.is_personal_override && <Button size="sm" variant="outline" onClick={() => delOverride.mutate(p.project_id)}>Удалить</Button>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">Персональные исключения переопределяют групповой доступ.</div>
            </Card>
          </div>
        )}

        {tab === "activity" && <div className="text-sm text-muted-foreground">Открыть аудит с фильтром по пользователю: <Link className="underline" to={`/admin/audit?user_id=${id}`}>/admin/audit?user_id={id}</Link></div>}
        {tab === "sessions" && (
          <div className="space-y-2">
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => revokeAll.mutate()}>Завершить все</Button></div>
            {(sessionsQ.data?.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет активных сессий</div>
            ) : (
              (sessionsQ.data?.data ?? []).map((s) => (
                <div key={s.id} className="grid grid-cols-[1.4fr_120px_150px_150px_150px_100px] gap-2 text-sm border rounded p-2 items-center">
                  <div>{s.user_agent || "Unknown device"}</div>
                  <div>{s.ip || "—"}</div>
                  <div>{new Date(s.issued_at).toLocaleString()}</div>
                  <div>{new Date(s.last_active).toLocaleString()}</div>
                  <div>{new Date(s.expires_at).toLocaleString()}</div>
                  <div><Button size="sm" variant="ghost" onClick={() => revokeOne.mutate(s.id)}>Revoke</Button></div>
                </div>
              ))
            )}
          </div>
        )}
        {tab === "danger" && <div className="text-sm text-red-400">Опасные действия: reset password / revoke sessions / deactivate / delete.</div>}
      </Card>
    </div>
  );
}
