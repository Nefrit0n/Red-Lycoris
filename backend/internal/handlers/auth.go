package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

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
	Token               string      `json:"token"`
	User                UserProfile `json:"user"`
	NeedsPasswordChange bool        `json:"needsPasswordChange"`
}

type AuthHandler struct {
	db           *sql.DB
	validator    *validator.Validate
	jwtSecret    string
	rootEmail    string
	rootPassword string
}

func NewAuthHandler(db *sql.DB, jwtSecret string, rootEmail string, rootPassword string) *AuthHandler {
	return &AuthHandler{
		db:           db,
		validator:    validator.New(),
		jwtSecret:    jwtSecret,
		rootEmail:    rootEmail,
		rootPassword: rootPassword,
	}
}

// Login godoc
// @Summary Login user
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param payload body LoginRequest true "Login request"
// @Success 200 {object} LoginResponse
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /api/v1/auth/login [post]
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
	if domainSeparatorIndex := strings.LastIndexAny(identifier, `\/`); domainSeparatorIndex != -1 && domainSeparatorIndex+1 < len(identifier) {
		loginUsername = identifier[domainSeparatorIndex+1:]
	}

	user, err := storage.GetUserByLogin(c.Context(), h.db, identifier, loginUsername)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch user"})
	}
	if user == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.Password)); err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
	}

	roles, err := storage.GetUserRoles(c.Context(), h.db, user.ID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch roles"})
	}
	if len(roles) == 0 {
		roles = []string{"user"}
	}

	needsPasswordChange := false
	if user.Email == h.rootEmail && !user.PasswordChanged {
		if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(h.rootPassword)); err == nil {
			needsPasswordChange = true
		}
	}

	claims := jwt.MapClaims{
		"user_id": user.ID.String(),
		"roles":   roles,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := jwtToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to generate token"})
	}

	resp := LoginResponse{
		Token:               tokenString,
		User:                buildUserProfile(user, roles),
		NeedsPasswordChange: needsPasswordChange,
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

// ChangePassword godoc
// @Summary Change user password
// @Description Change password for authenticated user
// @Tags auth
// @Accept json
// @Produce json
// @Param payload body ChangePasswordRequest true "Change password request"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /api/v1/auth/change_password [post]
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

	userIDRaw := c.Locals("user_id")
	userIDStr, ok := userIDRaw.(string)
	if !ok || userIDStr == "" {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "missing user context"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid user context"})
	}

	user, err := storage.GetUserByID(c.Context(), h.db, userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch user"})
	}
	if user == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "user not found"})
	}

	if req.CurrentPassword == "" {
		if user.Email != h.rootEmail || user.PasswordChanged {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "current password required"})
		}
	} else if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.CurrentPassword)); err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid credentials"})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to hash password"})
	}

	if err := storage.UpdateUserPassword(c.Context(), h.db, userID, string(hashed), true); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update password"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true})
}

// Logout godoc
// @Summary Logout user
// @Description Logout user (frontend clears token)
// @Tags auth
// @Produce json
// @Success 200 {object} fiber.Map
// @Router /api/v1/auth/logout [post]
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
