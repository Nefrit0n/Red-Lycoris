import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDestructiveActionModal } from "@/components/admin/ConfirmDestructiveActionModal";
import {
  bulkDeactivateUsers,
  bulkResetPasswords,
  exportUsersCSVUrl,
} from "@/api/admin-users";
import type { UserListParams } from "@/api/admin-users";

type BulkAction = "deactivate" | "resetPassword";

interface Props {
  selectedIds: string[];
  onClearSelection: () => void;
  currentParams: UserListParams;
}

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

export function UsersBulkBar({ selectedIds, onClearSelection, currentParams }: Props) {
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation({
    mutationFn: (reason: string) => bulkDeactivateUsers(selectedIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmAction(null);
      onClearSelection();
    },
  });

  const resetMutation = useMutation({
    mutationFn: (reason: string) =>
      bulkResetPasswords(selectedIds, generateTempPassword(), reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmAction(null);
      onClearSelection();
    },
  });

  if (selectedIds.length === 0) return null;

  function handleConfirm(reason: string) {
    if (confirmAction === "deactivate") deactivateMutation.mutate(reason);
    else if (confirmAction === "resetPassword") resetMutation.mutate(reason);
  }

  const isBusy = deactivateMutation.isPending || resetMutation.isPending;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-border bg-popover px-4 py-2.5 shadow-lg shadow-black/10">
        <span className="mr-2 text-sm font-medium text-foreground">
          {selectedIds.length} выбрано
        </span>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmAction("deactivate")}
          disabled={isBusy}
        >
          Деактивировать
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmAction("resetPassword")}
          disabled={isBusy}
        >
          Сбросить пароль
        </Button>

        <a
          href={exportUsersCSVUrl(currentParams)}
          download
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Экспорт CSV
        </a>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isBusy}
          className="text-muted-foreground"
        >
          Снять выделение
        </Button>
      </div>

      {confirmAction && (
        <ConfirmDestructiveActionModal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          title={
            confirmAction === "deactivate"
              ? `Деактивировать ${selectedIds.length} пользователей`
              : `Сбросить пароль для ${selectedIds.length} пользователей`
          }
          description={
            confirmAction === "deactivate"
              ? "Выбранные пользователи будут деактивированы. Их сессии завершатся. Системные аккаунты и последний администратор будут пропущены."
              : "Пароли выбранных пользователей будут сброшены. Они будут обязаны сменить пароль при следующем входе."
          }
          loading={isBusy}
        />
      )}
    </>
  );
}
