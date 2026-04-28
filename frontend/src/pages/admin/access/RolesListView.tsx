import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRoles } from "@/api/admin-access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RolesListView() {
  const rolesQ = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });
  const roles = rolesQ.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold">Системные роли</h2>
        <Button disabled title="Кастомные роли скоро">+ Создать роль</Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <Card key={r.id} className="p-4 space-y-2">
            <Badge>{r.key}</Badge>
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-muted-foreground">{r.description || "—"}</div>
            <div className="text-xs text-muted-foreground">Пользователей: {r.users_count}</div>
            <div className="flex flex-wrap gap-1">{r.permissions.map((p) => <Badge key={p.key} variant="secondary">{p.key}</Badge>)}</div>
            <Link to={`/admin/access/roles/${r.id}`} className="text-sm underline">Подробнее</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
