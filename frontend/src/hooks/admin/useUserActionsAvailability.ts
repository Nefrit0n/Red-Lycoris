import { AdminUser } from "@/api/admin-users";
import { CurrentUser } from "@/api/auth";

export interface UserActionAvailability {
  canDeactivate: boolean;
  canActivate: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
  canChangeRole: boolean;
  canTerminateSessions: boolean;
  disabledReasons: Partial<Record<string, string>>;
}

/**
 * Computes which admin actions are available for a target user,
 * mirroring the backend canModifyUser guard logic on the frontend
 * for immediate UI feedback (the backend will still enforce these rules).
 */
export function useUserActionsAvailability(
  target: AdminUser,
  currentUser: CurrentUser | null | undefined,
  activeAdminCount: number
): UserActionAvailability {
  const reasons: Partial<Record<string, string>> = {};

  const isSelf = !!currentUser && target.id === currentUser.id;
  const isSystem = target.is_system_account;
  const isLastAdmin =
    target.role.key === "admin" &&
    target.status === "active" &&
    activeAdminCount <= 1;

  if (isSelf) {
    reasons["deactivate"] = "Нельзя применить к собственной учётной записи";
    reasons["delete"] = "Нельзя применить к собственной учётной записи";
    reasons["changeRole"] = "Нельзя применить к собственной учётной записи";
    reasons["terminateSessions"] =
      "Нельзя применить к собственной учётной записи";
  }
  if (isSystem) {
    reasons["deactivate"] = "Системная учётная запись защищена";
    reasons["delete"] = "Системная учётная запись защищена";
    reasons["changeRole"] = "Системная учётная запись защищена";
  }
  if (isLastAdmin) {
    reasons["deactivate"] =
      reasons["deactivate"] ??
      "Нельзя оставить систему без активных администраторов";
    reasons["delete"] =
      reasons["delete"] ??
      "Нельзя оставить систему без активных администраторов";
    reasons["changeRole"] =
      reasons["changeRole"] ??
      "Нельзя оставить систему без активных администраторов";
  }

  return {
    canDeactivate:
      target.status !== "disabled" && !reasons["deactivate"],
    canActivate: target.status === "disabled" && !isSystem && !isSelf,
    canDelete: !reasons["delete"],
    canResetPassword: !isSelf,
    canChangeRole: !reasons["changeRole"],
    canTerminateSessions: !reasons["terminateSessions"],
    disabledReasons: reasons,
  };
}
