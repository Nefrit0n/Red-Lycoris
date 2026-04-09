package auth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

type User = domain.User
type Session = domain.Session

type Service struct {
	users           *storage.UsersRepo
	sessions        *storage.SessionsRepo
	sessionDuration time.Duration
}

var ErrInvalidCredentials = errors.New("invalid credentials")

func NewService(users *storage.UsersRepo, sessions *storage.SessionsRepo, sessionDuration time.Duration) *Service {
	return &Service{users: users, sessions: sessions, sessionDuration: sessionDuration}
}

func (s *Service) Login(ctx context.Context, email, password, userAgent, ip string) (*User, string, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", ErrInvalidCredentials
		}
		return nil, "", fmt.Errorf("auth.Service.Login: get user: %w", err)
	}

	ok, err := Verify(password, user.PasswordHash)
	if err != nil {
		return nil, "", fmt.Errorf("auth.Service.Login: verify password: %w", err)
	}
	if !ok || !user.IsActive {
		return nil, "", ErrInvalidCredentials
	}

	rawToken, err := GenerateToken()
	if err != nil {
		return nil, "", fmt.Errorf("auth.Service.Login: generate token: %w", err)
	}

	now := time.Now()
	parsedIP := net.ParseIP(ip)
	sess := &domain.Session{
		ID:         uuid.New(),
		UserID:     user.ID,
		TokenHash:  HashToken(rawToken),
		ExpiresAt:  now.Add(s.sessionDuration),
		UserAgent:  userAgent,
		IP:         parsedIP,
		CreatedAt:  now,
		LastUsedAt: now,
	}
	if err := s.sessions.Create(ctx, sess); err != nil {
		return nil, "", fmt.Errorf("auth.Service.Login: create session: %w", err)
	}
	if err := s.users.UpdateLastLogin(ctx, user.ID); err != nil {
		return nil, "", fmt.Errorf("auth.Service.Login: update last_login_at: %w", err)
	}
	user.LastLoginAt = &now

	return user, rawToken, nil
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	err := s.sessions.Revoke(ctx, HashToken(rawToken))
	if err != nil {
		return fmt.Errorf("auth.Service.Logout: revoke session: %w", err)
	}
	return nil
}

func (s *Service) Refresh(ctx context.Context, rawToken string) (*User, *Session, error) {
	user, session, err := s.ValidateToken(ctx, rawToken)
	if err != nil {
		return nil, nil, err
	}

	if time.Until(session.ExpiresAt) < 24*time.Hour {
		newExpiresAt := time.Now().Add(s.sessionDuration)
		if err := s.sessions.UpdateExpiresAt(ctx, session.ID, newExpiresAt); err != nil {
			return nil, nil, fmt.Errorf("auth.Service.Refresh: extend session: %w", err)
		}
		session.ExpiresAt = newExpiresAt
	}

	return user, session, nil
}

func (s *Service) ValidateToken(ctx context.Context, rawToken string) (*User, *Session, error) {
	session, user, err := s.sessions.GetByTokenHashWithUser(ctx, HashToken(rawToken))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("auth.Service.ValidateToken: get active session: %w", err)
	}

	if err := s.sessions.UpdateLastUsed(ctx, session.ID); err != nil {
		return nil, nil, fmt.Errorf("auth.Service.ValidateToken: update last_used_at: %w", err)
	}
	session.LastUsedAt = time.Now()

	return user, session, nil
}
