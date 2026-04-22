import { useMemo, useState } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateProjectToken, useProjectTokens, useRevokeProjectToken } from "@/api/project-security";

const AVAILABLE_SCOPES = [
  { value: "scans:write", label: "scans:write — загрузка отчётов сканеров" },
  { value: "findings:read", label: "findings:read — чтение находок" },
];

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "никогда";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

function expiresWarning(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const days = differenceInDays(new Date(iso), new Date());
  if (days < 0) return "истёк";
  if (days <= 3) return `истекает через ${days} д.`;
  return null;
}

export default function ProjectSettingsTokens({ projectId }: { projectId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["scans:write"]);
  const [createdToken, setCreatedToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const tokensQuery = useProjectTokens(projectId);
  const createMutation = useCreateProjectToken(projectId);
  const revokeMutation = useRevokeProjectToken(projectId);

  const tokens = useMemo(
    () => (tokensQuery.data ?? []).filter((t) => showRevoked || !t.revoked_at),
    [showRevoked, tokensQuery.data],
  );

  const handleCreate = async () => {
    if (!name || selectedScopes.length === 0) return;
    const response = await createMutation.mutateAsync({
      name,
      scopes: selectedScopes,
      expires_in_days: expiresInDays,
    });
    setCreatedToken(response.data.token);
    setCreateOpen(false);
    setResultOpen(true);
    setName("");
    setSelectedScopes(["scans:write"]);
    setExpiresInDays(30);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>API токены проекта</CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="rounded"
            />
            Показать отозванные
          </label>
          <Button onClick={() => setCreateOpen(true)}>Создать токен</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {tokens.length === 0 && (
          <p className="text-sm text-zinc-500">Нет токенов. Создайте первый для CI-интеграции.</p>
        )}
        {tokens.map((t) => {
          const warning = expiresWarning(t.expires_at);
          return (
            <div
              key={t.id}
              className={`rounded border p-3 ${t.revoked_at ? "border-zinc-800 opacity-50" : "border-zinc-700"}`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">{t.name}</div>
                  <div className="font-mono text-xs text-zinc-400">rl_pat_{t.prefix}_…</div>
                </div>
                {!t.revoked_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-800 text-red-400 hover:bg-red-950"
                    onClick={() => setConfirmRevokeId(t.id)}
                  >
                    Отозвать
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {t.scopes.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
                {warning && (
                  <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                    {warning}
                  </Badge>
                )}
                <span>Использован: {relativeTime(t.last_used_at)}</span>
                {t.expires_at && !warning && (
                  <span>Истекает: {new Date(t.expires_at).toLocaleDateString("ru-RU")}</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Диалог создания токена */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Создать API токен</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Название</label>
              <Input
                placeholder="например: gitlab-ci-main"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Права доступа</label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((s) => (
                  <label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(s.value)}
                      onChange={() => toggleScope(s.value)}
                      className="rounded"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Срок действия</label>
              <div className="flex gap-2">
                {([30, 90, null] as (number | null)[]).map((d) => (
                  <Button
                    key={String(d)}
                    size="sm"
                    variant={expiresInDays === d ? "default" : "outline"}
                    onClick={() => setExpiresInDays(d)}
                  >
                    {d === null ? "Без срока" : `${d} дней`}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!name || selectedScopes.length === 0 || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Создание…" : "Создать"}
            </Button>
            {createMutation.isError && (
              <p className="text-xs text-red-400">Ошибка при создании токена. Попробуйте снова.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Одноразовая модалка с токеном */}
      <Dialog open={resultOpen} onOpenChange={() => {}}>
        <DialogContent
          className="border-zinc-800 bg-zinc-900"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Сохраните токен</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold text-amber-400">
            Токен больше не будет показан. Сохраните его сейчас.
          </p>
          <div className="select-all rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs break-all">
            {createdToken}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="outline" className="flex-1">
              {copied ? "Скопировано ✓" : "Скопировать"}
            </Button>
            <Button
              onClick={() => {
                setResultOpen(false);
                setCopied(false);
              }}
              className="flex-1"
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm отзыва */}
      <Dialog open={confirmRevokeId !== null} onOpenChange={() => setConfirmRevokeId(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Отозвать токен?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-300">
            Токен будет немедленно деактивирован. CI-пайплайны, использующие его, начнут получать 401.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmRevokeId(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (confirmRevokeId) {
                  revokeMutation.mutate(confirmRevokeId, {
                    onSettled: () => setConfirmRevokeId(null),
                  });
                }
              }}
            >
              {revokeMutation.isPending ? "Отзыв…" : "Отозвать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
