import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRole } from "@/api/admin-access";
import { Card } from "@/components/ui/card";

export default function RoleDetailPage() {
  const { id = "" } = useParams();
  const roleQ = useQuery({ queryKey: ["admin-role", id], queryFn: () => fetchRole(id), enabled: !!id });
  const role = roleQ.data?.data;

  const grouped = (role?.permissions ?? []).reduce<Record<string, Array<{ key: string; resource: string; action: string; description: string }>>>((acc, p) => {
    (acc[p.resource] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-muted-foreground"><Link to="/admin/access/roles">Роли</Link> / {role?.name}</div>
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">{role?.name}</h2>
        <div className="text-sm text-muted-foreground">{role?.description}</div>
        <div className="text-sm">Пользователей: {role?.users_count ?? 0}</div>
        {Object.entries(grouped).map(([res, perms]) => (
          <div key={res}>
            <div className="font-medium capitalize">{res}</div>
            <ul className="text-sm list-disc pl-5">{perms.map((p) => <li key={p.key}>{p.action} — {p.description || p.key}</li>)}</ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
