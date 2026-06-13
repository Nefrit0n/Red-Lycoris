import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/api/admin-users";
import type { AdminUser } from "@/api/admin-users";

function validatePasswordStrength(password: string, email: string): string | null {
  if (password.trim().length < 12) return "Пароль должен содержать не менее 12 символов";
  if (password.toLowerCase() === email.toLowerCase()) return "Пароль не должен совпадать с email";
  return null;
}

function PasswordStrengthBar({ password, email }: { password: string; email: string }) {
  const error = password ? validatePasswordStrength(password, email) : null;

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*\-_=+]/.test(password)) score++;

  const colors = ["", "bg-red-500", "bg-red-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];
  const labels = ["", "Слабый", "Слабый", "Средний", "Хороший", "Сильный"];
  const filled = password ? colors[Math.min(score, 5)] : "bg-muted";

  return (
    <div className="space-y-1">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${i <= score && password ? filled : "bg-muted"}`}
          />
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && password && labels[Math.min(score, 5)] && (
        <p className="text-xs text-muted-foreground">{labels[Math.min(score, 5)]}</p>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: AdminUser;
}

export function ResetPasswordDialog({ open, onClose, user }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"generate" | "set">("generate");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reasonOk = reason.trim().length >= 10;
  const passwordError = mode === "set" && password ? validatePasswordStrength(password, user.email) : null;
  const setModeReady = mode === "set" && password.trim().length > 0 && passwordError === null;
  const canSubmit = reasonOk && (mode === "generate" || setModeReady);

  const mutation = useMutation({
    mutationFn: () =>
      resetPassword(user.id, {
        mode,
        password: mode === "set" ? password : undefined,
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", user.id] });
      if (result.data.temporary_password) {
        setGeneratedPassword(result.data.temporary_password);
      } else {
        handleClose();
      }
    },
  });

  function handleClose() {
    setMode("generate");
    setPassword("");
    setReason("");
    setGeneratedPassword(null);
    setCopied(false);
    onClose();
  }

  async function handleCopy() {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (generatedPassword) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base">Временный пароль сгенерирован</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              Этот пароль будет показан только один раз. После закрытия диалога получить его снова невозможно.
            </div>
            <div className="rounded-md border border-border bg-muted/50 px-4 py-3 flex items-center justify-between gap-3">
              <code className="text-sm font-mono tracking-wider select-all break-all">{generatedPassword}</code>
              <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? "Скопировано ✓" : "Копировать"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Все активные сессии пользователя{" "}
              <span className="text-foreground font-medium">{user.email}</span> завершены.
              При следующем входе пользователь будет обязан сменить пароль.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Сбросить пароль</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Пользователь:{" "}
            <span className="text-foreground font-medium">{user.email}</span>
          </p>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Все активные сессии пользователя будут завершены. При следующем входе потребуется смена пароля.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/70">Способ сброса</label>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  mode === "generate"
                    ? "bg-foreground text-background font-medium"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("generate")}
              >
                Сгенерировать
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-sm border-l border-border transition-colors ${
                  mode === "set"
                    ? "bg-foreground text-background font-medium"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("set")}
              >
                Задать вручную
              </button>
            </div>
          </div>

          {mode === "set" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">
                Новый пароль <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Не менее 12 символов"
                disabled={mutation.isPending}
                className="font-mono text-sm"
              />
              {password && <PasswordStrengthBar password={password} email={user.email} />}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/70">
              Причина <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50 min-h-[72px]"
              placeholder="Не менее 10 символов…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.isPending}
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-xs text-destructive">
                Ещё {10 - reason.trim().length} символов
              </p>
            )}
          </div>

          {mutation.isError && (
            <p className="text-xs text-destructive">
              Ошибка: {(mutation.error as Error)?.message ?? "Не удалось сбросить пароль"}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? "Выполняется…" : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
