import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroup, deleteGroup, fetchGroupsAdmin } from "@/api/admin-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function GroupsListView() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorKey, setColorKey] = useState("0");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const groupsQ = useQuery({ queryKey: ["admin-groups", q], queryFn: () => fetchGroupsAdmin(q) });
  const createM = useMutation({ mutationFn: createGroup, onSuccess: (res) => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-groups"] }); navigate(`/admin/access/groups/${res.data.id}`); } });
  const delM = useMutation({ mutationFn: deleteGroup, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-groups"] }) });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск группы" className="max-w-sm" />
        <Button onClick={() => setOpen(true)}>+ Создать группу</Button>
      </div>
      <Card>
        <div className="divide-y">
          {(groupsQ.data?.data ?? []).map((g) => (
            <div key={g.id} className="grid grid-cols-[4px_1.5fr_90px_90px_100px_120px_100px] gap-2 items-center p-3">
              <div className="h-full rounded" style={{ backgroundColor: `var(--group-${g.color_key}, #6366f1)` }} />
              <div>
                <Link to={`/admin/access/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link>
                <div className="text-xs text-muted-foreground">{g.description || "—"}</div>
              </div>
              <div>{g.members_count}</div>
              <div>{g.projects_count}</div>
              <div>{g.source}</div>
              <div className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</div>
              <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => delM.mutate(g.id)}>Удалить</Button></div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Создать группу</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input placeholder="Цвет" value={colorKey} onChange={(e) => setColorKey(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={() => createM.mutate({ name, description, color_key: colorKey })}>Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
