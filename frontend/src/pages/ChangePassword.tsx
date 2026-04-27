import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiPost } from "@/api/client";
import { ApiClientError } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiPost("/api/v1/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      navigate("/", { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code === "INVALID_CURRENT_PASSWORD") {
        setError("Текущий пароль неверен");
        return;
      }
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        setError(err.message);
        return;
      }
      setError("Не удалось сменить пароль");
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <div className="mb-3 flex items-center justify-center">
            <img src="/logo_full.svg" alt="RedLycoris" className="h-10" />
          </div>
          <CardTitle className="text-center">Смена пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Необходимо сменить пароль перед продолжением работы
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Текущий пароль"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Новый пароль (не менее 8 символов)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={
                mutation.isPending ||
                !currentPassword ||
                newPassword.length < 8
              }
            >
              {mutation.isPending ? "Сохранение..." : "Сменить пароль"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
