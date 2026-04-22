package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

// AdminAction — тип деструктивного действия над пользователем.
type AdminAction string

const (
	ActionDeactivate      AdminAction = "deactivate"
	ActionActivate        AdminAction = "activate"
	ActionDelete          AdminAction = "delete"
	ActionResetPassword   AdminAction = "reset_password"
	ActionResetMFA        AdminAction = "reset_mfa"
	ActionRemoveRoleAdmin AdminAction = "remove_role_admin"
)

// sessionRevokeReason возвращает строку revoked_reason для хранения в сессиях.
func sessionRevokeReason(action AdminAction) string {
	switch action {
	case ActionDeactivate:
		return "deactivated"
	case ActionResetPassword:
		return "password_changed"
	case ActionRemoveRoleAdmin:
		return "role_changed"
	default:
		return "admin_revoke"
	}
}

// adminCountRepo — минимальный интерфейс для проверки количества активных admin'ов.
// Реализуется storage.UsersRepo; в тестах подменяется стабом.
type adminCountRepo interface {
	CountActiveAdmins(ctx context.Context) (int, error)
}

// guardError — ошибка с HTTP-кодом, кодом домена и сообщением.
type guardError struct {
	httpStatus int
	code       string
	message    string
}

func (e *guardError) Error() string { return e.message }

var (
	errSelfModification = &guardError{
		http.StatusForbidden, "SELF_MODIFICATION_FORBIDDEN",
		"Нельзя применить к собственной учётной записи",
	}
	errSystemAccountProtected = &guardError{
		http.StatusForbidden, "SYSTEM_ACCOUNT_PROTECTED",
		"Системная учётная запись защищена",
	}
	errLastAdminProtected = &guardError{
		http.StatusForbidden, "LAST_ADMIN_PROTECTED",
		"Нельзя оставить систему без активных администраторов",
	}
)

// canModifyUser — авторитетная серверная проверка перед любым mutating действием
// над пользователем. Фронтенд дублирует эти проверки для UX, но бэк —
// единственный источник истины.
func canModifyUser(
	ctx context.Context,
	repo adminCountRepo,
	actorID uuid.UUID,
	target *domain.User,
	action AdminAction,
) error {
	// Правило 1: нельзя деструктивно действовать на себя
	if actorID == target.ID {
		switch action {
		case ActionDeactivate, ActionDelete, ActionResetPassword,
			ActionResetMFA, ActionRemoveRoleAdmin:
			return errSelfModification
		}
	}

	// Правило 2: системный аккаунт неприкосновенен
	if target.IsSystemAccount {
		switch action {
		case ActionDelete, ActionDeactivate, ActionRemoveRoleAdmin:
			return errSystemAccountProtected
		}
	}

	// Правило 3: нельзя оставить систему без активных admin'ов
	if action == ActionRemoveRoleAdmin || action == ActionDeactivate {
		if target.IsAdmin() {
			count, err := repo.CountActiveAdmins(ctx)
			if err != nil {
				return fmt.Errorf("canModifyUser: %w", err)
			}
			if count <= 1 {
				return errLastAdminProtected
			}
		}
	}

	return nil
}

// respondGuardError пишет ответ 403/500 по типу ошибки от canModifyUser.
func respondGuardError(w http.ResponseWriter, r *http.Request, err error) {
	if ge, ok := err.(*guardError); ok {
		respondError(w, r, ge.httpStatus, ge.code, ge.message)
		return
	}
	respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
}
