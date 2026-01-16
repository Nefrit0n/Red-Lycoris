package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type UserProfile struct {
	ID       string   `json:"id"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  UserProfile `json:"user"`
}

type AuthHandler struct {
	db        *sql.DB
	validator *validator.Validate
	jwtSecret string
}

func NewAuthHandler(db *sql.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		db:        db,
		validator: validator.New(),
		jwtSecret: jwtSecret,
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

	user, err := storage.GetUserByEmail(c.Context(), h.db, req.Email)
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
		Token: tokenString,
		User:  buildUserProfile(user, roles),
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
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
