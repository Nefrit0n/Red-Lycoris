import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addGroupMembers, deleteGroup, deleteGroupProject, fetchGroup, fetchGroupMembers, fetchGroupProjects, patchGroup, putGroupProject, removeGroupMember, searchAssignableUsers } from "@/api/admin-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function GroupDetailPage() {
  const { id = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "members";
  const qc = useQueryClient();
  const [userQ, setUserQ] = useState("");

  const groupQ = useQuery({ queryKey: ["group", id], queryFn: () => fetchGroup(id), enabled: !!id });
  const membersQ = useQuery({ queryKey: ["group-members", id], queryFn: () => fetchGroupMembers(id), enabled: !!id });
  const projectsQ = useQuery({ queryKey: ["group-projects", id], queryFn: () => fetchGroupProjects(id), enabled: !!id });
  const userSearchQ = useQuery({
    queryKey: ["group-member-search", userQ],
    queryFn: () => searchAssignableUsers(userQ),
    enabled: tab === "members" && userQ.trim().length >= 2,
  });

  const addMemberM = useMutation({ mutationFn: (uid: string) => addGroupMembers(id, [uid]), onSuccess: () => qc.invalidateQueries({ queryKey: ["group-members", id] }) });
  const removeMemberM = useMutation({ mutationFn: (uid: string) => removeGroupMember(id, uid), onSuccess: () => qc.invalidateQueries({ queryKey: ["group-members", id] }) });
  const setProjectM = useMutation({ mutationFn: ({ pid, level }: { pid: string; level: "read"|"write"|"admin" }) => putGroupProject(id, pid, level), onSuccess: () => qc.invalidateQueries({ queryKey: ["group-projects", id] }) });
  const delProjectM = useMutation({ mutationFn: (pid: string) => deleteGroupProject(id, pid), onSuccess: () => qc.invalidateQueries({ queryKey: ["group-projects", id] }) });
  const saveM = useMutation({ mutationFn: (payload: { name: string; description: string; color_key: string }) => patchGroup(id, payload), onSuccess: () => qc.invalidateQueries({ queryKey: ["group", id] }) });
  const delM = useMutation({ mutationFn: () => deleteGroup(id) });

  const g = groupQ.data?.data;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("0");

  return (
    <div className="space-y-4 p-6">
      <div className="text-sm text-muted-foreground"><Link to="/admin/access/groups">Группы</Link> / {g?.name}</div>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><span className="w-2 h-8 rounded" style={{ backgroundColor: `var(--group-${g?.color_key}, #6366f1)` }} /> <h2 className="text-lg font-semibold">{g?.name}</h2></div>
        <div className="text-sm text-muted-foreground">{g?.description}</div>
        <div className="flex gap-2">{["members","projects","settings"].map((k)=><Button key={k} size="sm" variant={tab===k?"default":"ghost"} onClick={()=>setSp({tab:k})}>{k}</Button>)}</div>

        {tab === "members" && (
          <div className="space-y-2">
            <Input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Поиск пользователя по email/имени" />
            {!!userQ && (
              <div className="flex flex-wrap gap-2">
                {(userSearchQ.data?.data ?? []).map((u) => (
                  <Button key={u.id} size="sm" variant="outline" onClick={() => addMemberM.mutate(u.id)}>
                    + {u.email}
                  </Button>
                ))}
              </div>
            )}
            {(membersQ.data?.data ?? []).map((m) => <div key={m.user_id} className="flex justify-between border rounded p-2"><Link to={`/admin/access/users/${m.user_id}`}>{m.email}</Link><Button size="sm" variant="ghost" onClick={() => removeMemberM.mutate(m.user_id)}>Убрать</Button></div>)}
          </div>
        )}

        {tab === "projects" && (
          <div className="space-y-2">{(projectsQ.data?.data ?? []).map((p) => (
            <div key={p.project_id} className="flex items-center justify-between border rounded p-2">
              <span>{p.project_name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setProjectM.mutate({ pid: p.project_id, level: "read" })}>read</Button>
                <Button size="sm" variant="outline" onClick={() => setProjectM.mutate({ pid: p.project_id, level: "write" })}>write</Button>
                <Button size="sm" variant="outline" onClick={() => setProjectM.mutate({ pid: p.project_id, level: "admin" })}>admin</Button>
                <Button size="sm" variant="ghost" onClick={() => delProjectM.mutate(p.project_id)}>Удалить</Button>
              </div>
            </div>
          ))}</div>
        )}

        {tab === "settings" && (
          <div className="space-y-3 max-w-md">
            <Input placeholder="Имя" defaultValue={g?.name} onChange={(e)=>setName(e.target.value)} />
            <Input placeholder="Описание" defaultValue={g?.description} onChange={(e)=>setDescription(e.target.value)} />
            <Input placeholder="Цвет" defaultValue={g?.color_key} onChange={(e)=>setColor(e.target.value)} />
            <div className="flex gap-2"><Button onClick={() => saveM.mutate({ name: name || g?.name || "", description: description || g?.description || "", color_key: color || g?.color_key || "0" })}>Сохранить</Button><Button variant="destructive" onClick={() => delM.mutate()}>Удалить группу</Button></div>
          </div>
        )}
      </Card>
    </div>
  );
}
