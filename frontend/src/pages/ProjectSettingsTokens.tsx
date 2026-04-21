import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateProjectToken, useProjectTokens, useRevokeProjectToken } from "@/api/project-security";

export default function ProjectSettingsTokens({ projectId }: { projectId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [createdToken, setCreatedToken] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);

  const tokensQuery = useProjectTokens(projectId);
  const createMutation = useCreateProjectToken(projectId);
  const revokeMutation = useRevokeProjectToken(projectId);

  const tokens = useMemo(
    () => (tokensQuery.data ?? []).filter((t) => showRevoked || !t.revoked_at),
    [showRevoked, tokensQuery.data],
  );

  const handleCreate = async () => {
    const response = await createMutation.mutateAsync({
      name,
      scopes: ["scans:write"],
      expires_in_days: expiresInDays,
    });
    setCreatedToken(response.data.token);
    setCreateOpen(false);
    setResultOpen(true);
    setName("");
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>API токены проекта</CardTitle>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">
            <input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} className="mr-2" />
            Показать отозванные
          </label>
          <Button onClick={() => setCreateOpen(true)}>Создать токен</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tokens.map((t) => (
          <div key={t.id} className={`rounded border p-3 ${t.revoked_at ? "border-zinc-800 opacity-50" : "border-zinc-700"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="font-mono text-xs text-zinc-400">rl_pat_{t.prefix}_…</div>
              </div>
              {!t.revoked_at && (
                <Button size="sm" variant="outline" onClick={() => revokeMutation.mutate(t.id)}>
                  Отозвать
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {t.scopes.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
              {t.expires_at && <Badge variant="outline">exp: {new Date(t.expires_at).toLocaleDateString()}</Badge>}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Создать токен</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <Button variant={expiresInDays === 30 ? "default" : "outline"} onClick={() => setExpiresInDays(30)}>30 дней</Button>
              <Button variant={expiresInDays === 90 ? "default" : "outline"} onClick={() => setExpiresInDays(90)}>90 дней</Button>
              <Button variant={expiresInDays === null ? "default" : "outline"} onClick={() => setExpiresInDays(null)}>Без срока</Button>
            </div>
            <Button onClick={handleCreate} disabled={!name || createMutation.isPending}>Создать</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Сохраните токен</DialogTitle></DialogHeader>
          <p className="text-sm font-semibold text-amber-400">Токен больше не будет показан. Сохраните его сейчас.</p>
          <div className="rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs break-all">{createdToken}</div>
          <Button onClick={() => navigator.clipboard.writeText(createdToken)}>Скопировать</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
