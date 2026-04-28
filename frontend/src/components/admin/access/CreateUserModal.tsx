import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminUser,
  checkEmailAvailable,
  checkPasswordHIBP,
  fetchGroups,
} from "@/api/admin-users";
import type { CreateUserPayload, GroupSummary } from "@/api/admin-users";
import { usePasswordStrength } from "@/hooks/admin/usePasswordStrength";
import { cn } from "@/lib/utils";

type RoleKey = "admin" | "auditor" | "member" | "viewer";

const ROLE_OPTIONS: { key: RoleKey; label: string; desc: string }[] = [
  { key: "admin", label: "◈ Администратор", desc: "Полный доступ" },
  { key: "auditor", label: "Аудитор", desc: "Чтение + аудит" },
  { key: "member", label: "Участник", desc: "Работа с findings" },
  { key: "viewer", label: "Наблюдатель", desc: "Только чтение" },
];

const PASSWORD_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+";

function generatePassword(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>("member");
  const [selectedGroups, setSelectedGroups] = useState<GroupSummary[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // Email check
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // HIBP check
  const [hibpResult, setHibpResult] = useState<{
    pwned: boolean;
    unavailable: boolean;
  } | null>(null);
  const hibpDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const strength = usePasswordStrength(password);

  const groupsQuery = useQuery({
    queryKey: ["admin-groups", groupSearch],
    queryFn: () => fetchGroups(groupSearch, 10),
    enabled: open,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createAdminUser(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
      navigate(`/admin/access/users/${res.data.id}`);
    },
  });

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setDisplayName("");
    setPassword("");
    setRoleKey("member");
    setSelectedGroups([]);
    setSendEmail(false);
    setGroupSearch("");
    setEmailStatus("idle");
    setHibpResult(null);
    mutation.reset();
  }, [open]);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    setEmailStatus("idle");
    clearTimeout(emailDebounceRef.current);
    if (!value.includes("@")) return;
    setEmailStatus("checking");
    emailDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkEmailAvailable(value.trim().toLowerCase());
        setEmailStatus(res.data.available ? "ok" : "taken");
      } catch {
        setEmailStatus("idle");
      }
    }, 400);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setHibpResult(null);
    clearTimeout(hibpDebounceRef.current);
    if (value.length < 8) return;
    hibpDebounceRef.current = setTimeout(async () => {
      const result = await checkPasswordHIBP(value);
      setHibpResult(result);
    }, 800);
  }, []);

  function handleGenerate() {
    const p = generatePassword();
    setPassword(p);
    handlePasswordChange(p);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addGroup(group: GroupSummary) {
    if (!selectedGroups.some((g) => g.id === group.id)) {
      setSelectedGroups((p) => [...p, group]);
    }
    setGroupSearch("");
  }

  function removeGroup(id: string) {
    setSelectedGroups((p) => p.filter((g) => g.id !== id));
  }

  const isValid =
    email.includes("@") &&
    emailStatus !== "taken" &&
    password.length >= 12 &&
    strength.score >= 2 &&
    hibpResult?.pwned !== true;

  function handleSubmit() {
    if (!isValid || mutation.isPending) return;
    mutation.mutate({
      email: email.trim().toLowerCase(),
      display_name: displayName.trim(),
      password,
      role_key: roleKey,
      group_ids: selectedGroups.map((g) => g.id),
      send_credentials_email: sendEmail,
    });
  }

  const availableGroups = (groupsQuery.data?.data ?? []).filter(
    (g) => !selectedGroups.some((s) => s.id === g.id)
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать пользователя</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Email + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                {emailStatus === "ok" && (
                  <span className="text-[10px] text-green-600 dark:text-green-400">✓ свободен</span>
                )}
                {emailStatus === "taken" && (
                  <span className="text-[10px] text-destructive">✗ занят</span>
                )}
                {emailStatus === "checking" && (
                  <span className="text-[10px] text-muted-foreground">…</span>
                )}
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="user@example.com"
                className={cn(
                  "h-8 text-sm",
                  emailStatus === "taken" && "border-destructive"
                )}
              />
              {mutation.isError && (mutation.error as Error)?.message?.includes("EMAIL_TAKEN") && (
                <p className="text-xs text-destructive">Email уже используется</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">ФИО</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Иванов Иван"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-medium">
              Временный пароль <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Минимум 12 символов…"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50 h-8"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleGenerate} className="h-8 px-2 shrink-0">
                ⟳
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                disabled={!password}
                className="h-8 px-2 shrink-0"
              >
                {copied ? "✓" : "⎘"}
              </Button>
            </div>

            {/* Strength indicator */}
            {password && (
              <>
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor:
                          i < strength.score ? strength.color : "var(--border)",
                      }}
                    />
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: strength.color }}>
                  {password.length} символов · {strength.label}
                  {hibpResult?.pwned && " · ⚠ найден в утечках, выберите другой"}
                  {hibpResult?.unavailable && " · проверка утечек недоступна"}
                  {hibpResult && !hibpResult.pwned && !hibpResult.unavailable && " · не найден в базе утечек"}
                </p>
              </>
            )}
          </div>

          {/* Info block */}
          <div
            className="rounded-md px-3 py-2.5 text-xs leading-relaxed"
            style={{
              backgroundColor: "oklch(from var(--primary) l c h / 0.07)",
              color: "var(--foreground)",
            }}
          >
            ✓ Пользователь будет обязан сменить пароль при первом входе.
            Это поведение зафиксировано и не отключается.
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">
              Роль <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRoleKey(opt.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all text-xs",
                    roleKey === opt.key
                      ? "border-primary bg-primary/5 text-foreground font-semibold ring-2 ring-primary/30"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span className="font-medium leading-tight">{opt.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Группы</label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-md border border-input bg-background px-2 py-1.5">
              {selectedGroups.map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-xs"
                >
                  {g.name}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => removeGroup(g.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                placeholder={selectedGroups.length === 0 ? "Поиск группы…" : ""}
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
            {groupSearch && availableGroups.length > 0 && (
              <div className="rounded-md border border-border bg-popover shadow-md">
                {availableGroups.slice(0, 8).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                    onClick={() => addGroup(g)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send email checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded"
            />
            Отправить учётные данные на email пользователя
          </label>

          {mutation.isError && (
            <p className="text-xs text-destructive">
              Ошибка при создании пользователя. Попробуйте ещё раз.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? "Создание…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
