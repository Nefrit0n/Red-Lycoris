import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDestructiveActionModal } from "@/components/admin/ConfirmDestructiveActionModal";
import {
  deactivateUser,
  activateUser,
  deleteUser,
  resetUserPassword,
} from "@/api/admin-users";
import type { AdminUser } from "@/api/admin-users";
import type { CurrentUser } from "@/api/auth";
import { useUserActionsAvailability } from "@/hooks/admin/useUserActionsAvailability";
import { cn } from "@/lib/utils";

type ActionType = "deactivate" | "delete" | "resetPassword" | "terminateSessions";

interface Props {
  user: AdminUser;
  currentUser: CurrentUser | null | undefined;
  activeAdminCount: number;
}

export function UserKebabMenu({ user, currentUser, activeAdminCount }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const availability = useUserActionsAvailability(user, currentUser, activeAdminCount);

  const [confirmAction, setConfirmAction] = useState<ActionType | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ action, reason }: { action: ActionType; reason: string }) => {
      switch (action) {
        case "deactivate":
          return deactivateUser(user.id, reason);
        case "delete":
          return deleteUser(user.id, reason);
        case "resetPassword":
          // For kebab menu, generate a temp password
          return resetUserPassword(user.id, generateTempPassword(), reason);
        case "terminateSessions":
          return deactivateUser(user.id, reason); // sessions are revoked on deactivate
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmAction(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => activateUser(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  function handleConfirm(reason: string) {
    if (!confirmAction) return;
    mutation.mutate({ action: confirmAction, reason });
  }

  const confirmTitles: Record<ActionType, string> = {
    deactivate: "Деактивировать пользователя",
    delete: "Удалить пользователя",
    resetPassword: "Сбросить пароль",
    terminateSessions: "Завершить все сессии",
  };

  const confirmDescriptions: Record<ActionType, string> = {
    deactivate: `Пользователь ${user.email} будет деактивирован. Все активные сессии завершатся.`,
    delete: `Пользователь ${user.email} будет удалён (soft delete). Действие необратимо.`,
    resetPassword: `Пароль пользователя ${user.email} будет сброшен. Пользователь будет вынужден сменить его при следующем входе.`,
    terminateSessions: `Все сессии пользователя ${user.email} будут завершены принудительно.`,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <span className="text-base leading-none">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/access/users/${user.id}`); }}>
            Перейти к профилю
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <MenuAction
            label="Сбросить пароль"
            disabled={!availability.canResetPassword}
            disabledReason={availability.disabledReasons["resetPassword"]}
            onClick={() => setConfirmAction("resetPassword")}
          />

          <MenuAction
            label="Сбросить MFA"
            disabled
            disabledReason="MFA пока не настроена в системе"
            onClick={() => undefined}
          />

          <MenuAction
            label="Завершить все сессии"
            disabled={!availability.canTerminateSessions}
            disabledReason={availability.disabledReasons["terminateSessions"]}
            onClick={() => setConfirmAction("terminateSessions")}
          />

          <DropdownMenuSeparator />

          {user.status === "disabled" ? (
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); activateMutation.mutate(); }}
              className="text-foreground"
            >
              Активировать
            </DropdownMenuItem>
          ) : (
            <MenuAction
              label="Деактивировать"
              disabled={!availability.canDeactivate}
              disabledReason={availability.disabledReasons["deactivate"]}
              onClick={() => setConfirmAction("deactivate")}
              className="text-destructive focus:text-destructive"
            />
          )}

          <MenuAction
            label="Удалить"
            disabled={!availability.canDelete}
            disabledReason={availability.disabledReasons["delete"]}
            onClick={() => setConfirmAction("delete")}
            className="text-destructive focus:text-destructive"
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmAction && (
        <ConfirmDestructiveActionModal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          title={confirmTitles[confirmAction]}
          description={confirmDescriptions[confirmAction]}
          requireMatch={confirmAction === "delete" ? user.email : undefined}
          loading={mutation.isPending}
        />
      )}
    </>
  );
}

function MenuAction({
  label,
  disabled,
  disabledReason,
  onClick,
  className,
}: {
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
  className?: string;
}) {
  const item = (
    <DropdownMenuItem
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      className={cn(className, disabled && "opacity-40 cursor-not-allowed")}
    >
      {label}
    </DropdownMenuItem>
  );

  if (disabled && disabledReason) {
    return <Tooltip content={disabledReason}>{item}</Tooltip>;
  }
  return item;
}

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}
