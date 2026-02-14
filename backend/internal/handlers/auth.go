package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"red-lycoris/backend/internal/middleware"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Login    string `json:"login" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword    string `json:"currentPassword"`
	NewPassword        string `json:"newPassword" validate:"required,min=8"`
	NewPasswordConfirm string `json:"newPasswordConfirm" validate:"required"`
}

type UserProfile struct {
	ID       string   `json:"id"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
}

type LoginResponse struct {
	Token              string      `json:"token"`
	User               UserProfile `json:"user"`
	MustChangePassword bool        `json:"mustChangePassword"`
}

type AuthHandler struct {
	db        *sql.DB
	validator *validator.Validate
	jwtSecret string
	rootEmail string
}

func NewAuthHandler(db *sql.DB, jwtSecret string, rootEmail string) *AuthHandler {
	return &AuthHandler{
		db:        db,
		validator: validator.New(),
		jwtSecret: jwtSecret,
		rootEmail: rootEmail,
	}
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	identifier := strings.TrimSpace(req.Login)
	loginUsername := identifier

	if idx := strings.LastIndexAny(identifier, `\/`); idx != -1 && idx+1 < len(identifier) {
		loginUsername = identifier[idx+1:]
	}
	if at := strings.LastIndex(loginUsername, "@"); at > 0 {
		loginUsername = loginUsername[:at]
	}

	user, err := storage.GetUserByLogin(c.Context(), h.db, identifier, loginUsername)
	if err != nil || user == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.Password)); err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
	}

	if user.TenantID == uuid.Nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
	}

	roles, err := storage.GetUserRoles(c.Context(), h.db, user.ID)
	if err != nil || len(roles) == 0 {
		roles = []string{"user"}
	}

	needsPasswordChange := user.MustChangePassword

	claims := middleware.JWTClaims{
		UserID:             user.ID.String(),
		TenantID:           user.TenantID.String(),
		Roles:              roles,
		OrgRole:            string(resolveOrgRole(roles)),
		MustChangePassword: needsPasswordChange,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to generate token"})
	}

	resp := LoginResponse{
		Token:              tokenString,
		User:               buildUserProfile(user, roles),
		MustChangePassword: needsPasswordChange,
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	var req ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	if req.NewPassword != req.NewPasswordConfirm {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "passwords do not match"})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "missing user context"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid user context"})
	}

	user, err := storage.GetUserByID(c.Context(), h.db, userID)
	if err != nil || user == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "user not found"})
	}

	if user.PasswordChanged {
		if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.CurrentPassword)); err != nil {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
		}
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to hash password"})
	}

	if err := storage.UpdateUserPassword(c.Context(), h.db, userID, string(hashed), true, false); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update password"})
	}

	roles, err := storage.GetUserRoles(c.Context(), h.db, userID)
	if err != nil || len(roles) == 0 {
		roles = []string{"user"}
	}

	claims := middleware.JWTClaims{
		UserID:             user.ID.String(),
		TenantID:           user.TenantID.String(),
		Roles:              roles,
		OrgRole:            string(resolveOrgRole(roles)),
		MustChangePassword: false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to generate token"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": fiber.Map{"token": tokenString}})
}

func resolveOrgRole(roles []string) models.OrgRole {
	set := map[string]struct{}{}
	for _, role := range roles {
		set[role] = struct{}{}
	}
	if _, ok := set[string(models.OrgRoleOwner)]; ok {
		return models.OrgRoleOwner
	}
	if _, ok := set[string(models.OrgRoleAdmin)]; ok {
		return models.OrgRoleAdmin
	}
	if _, ok := set[string(models.OrgRoleSecurityManager)]; ok {
		return models.OrgRoleSecurityManager
	}
	return models.OrgRoleViewer
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true})
}

func buildUserProfile(user *models.User, roles []string) UserProfile {
	return UserProfile{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		Roles:    roles,
	}
}
