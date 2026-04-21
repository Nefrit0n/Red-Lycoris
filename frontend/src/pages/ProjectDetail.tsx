import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { useCurrentUser } from "@/api/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProjectSettingsTokens from "@/pages/ProjectSettingsTokens";
import ProjectScans from "@/pages/ProjectScans";

interface Project {
  id: string;
  name: string;
  description?: string;
  tags: string[];
}
interface Member {
  user_id: string;
  email: string;
  full_name: string;
  role: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const res = await apiGet<{ data: Project }>(`/api/v1/projects/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const membersQuery = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const res = await apiGet<{ data: Member[] }>(`/api/v1/projects/${id}/members`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const myRole = useMemo(() => {
    const me = (membersQuery.data ?? []).find((m) => m.email === user?.email);
    return me?.role ?? -1;
  }, [membersQuery.data, user?.email]);

  const canManageMembers = myRole >= 2 || user?.global_role === 1;

  const searchUsers = useQuery({
    queryKey: ["users-search", q],
    queryFn: async () => {
      const res = await apiGet<{ data: Array<{ id: string; email: string; full_name: string }> }>(
        "/api/v1/users/search",
        { q },
      );
      return res.data;
    },
    enabled: q.length > 1,
  });

  const addMember = useMutation({
    mutationFn: () => apiPost(`/api/v1/projects/${id}/members`, { user_id: selectedUser, role: 1 }),
    onSuccess: async () => {
      setAddOpen(false);
      setSelectedUser("");
      await queryClient.invalidateQueries({ queryKey: ["project-members", id] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: number }) =>
      apiPut(`/api/v1/projects/${id}/members/${userId}`, { role }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["project-members", id] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiDelete(`/api/v1/projects/${id}/members/${userId}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["project-members", id] }),
  });

  if (!id) return <Navigate to="/projects" replace />;

  const tabFromQuery = searchParams.get("tab");
  const activeTab =
    tabFromQuery === "overview" ||
    tabFromQuery === "findings" ||
    tabFromQuery === "members" ||
    tabFromQuery === "tokens" ||
    tabFromQuery === "scans"
      ? tabFromQuery
      : "overview";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set("tab", value);
        setSearchParams(next, { replace: true });
      }}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="overview">Обзор</TabsTrigger>
        <TabsTrigger value="findings">Находки</TabsTrigger>
        <TabsTrigger value="members">Участники</TabsTrigger>
        <TabsTrigger value="tokens">Токены</TabsTrigger>
        <TabsTrigger value="scans">Сканы</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>{projectQuery.data?.name ?? "Проект"}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-zinc-300">{projectQuery.data?.description || "Описание отсутствует"}</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="findings">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Находки проекта</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/findings?project_id=${id}`)}>Перейти к находкам</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members">
        {!canManageMembers ? (
          <Card className="border-zinc-800 bg-zinc-900"><CardContent className="pt-6">Недостаточно прав для управления участниками.</CardContent></Card>
        ) : (
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Участники</CardTitle>
              <Button onClick={() => setAddOpen(true)}>Добавить участника</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(membersQuery.data ?? []).map((m) => (
                <div key={m.user_id} className="flex items-center justify-between rounded border border-zinc-800 p-2">
                  <div>
                    <div>{m.full_name || m.email}</div>
                    <div className="text-xs text-zinc-400">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{m.role === 2 ? "Project Admin" : m.role === 1 ? "Triager" : "Viewer"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => updateMemberRole.mutate({ userId: m.user_id, role: m.role === 2 ? 1 : 2 })}>Изменить роль</Button>
                    <Button size="sm" variant="outline" onClick={() => removeMember.mutate(m.user_id)}>Удалить</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="tokens">
        <ProjectSettingsTokens projectId={id} />
      </TabsContent>

      <TabsContent value="scans">
        <ProjectScans projectId={id} />
      </TabsContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Добавить участника</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Поиск пользователя" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-48 space-y-1 overflow-auto">
              {(searchUsers.data ?? []).map((u) => (
                <button
                  key={u.id}
                  className="w-full rounded border border-zinc-800 px-2 py-1 text-left hover:bg-zinc-800"
                  onClick={() => setSelectedUser(u.id)}
                >
                  <div>{u.full_name || "Без имени"}</div>
                  <div className="text-xs text-zinc-400">{u.email}</div>
                </button>
              ))}
            </div>
            <Button disabled={!selectedUser} onClick={() => addMember.mutate()}>Добавить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden">
        <Link to="/projects" />
      </div>
    </Tabs>
  );
}
