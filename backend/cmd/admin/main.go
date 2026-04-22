package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"redlycoris/internal/auth"
	"redlycoris/internal/config"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := storage.NewPostgresPool(ctx, cfg.DatabaseURL, 10, 1)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db connection error: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	usersRepo := storage.NewUsersRepo(pool)

	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "create-user":
		if err := runCreateUser(ctx, usersRepo, os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "create-user error: %v\n", err)
			os.Exit(1)
		}
	case "reset-password":
		if err := runResetPassword(ctx, usersRepo, os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "reset-password error: %v\n", err)
			os.Exit(1)
		}
	case "list-users":
		if err := runListUsers(ctx, usersRepo, os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "list-users error: %v\n", err)
			os.Exit(1)
		}
	case "deactivate":
		if err := runDeactivate(ctx, usersRepo, os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "deactivate error: %v\n", err)
			os.Exit(1)
		}
	default:
		usage()
		os.Exit(1)
	}
}

func runCreateUser(ctx context.Context, usersRepo *storage.UsersRepo, args []string) error {
	fs := flag.NewFlagSet("create-user", flag.ContinueOnError)
	email := fs.String("email", "", "user email")
	password := fs.String("password", "", "user password")
	admin := fs.Bool("admin", false, "create admin user")
	fullName := fs.String("full-name", "", "full name")
	if err := fs.Parse(args); err != nil {
		return err
	}

	normEmail := strings.ToLower(strings.TrimSpace(*email))
	if normEmail == "" || strings.TrimSpace(*password) == "" {
		return fmt.Errorf("--email and --password are required")
	}

	passwordHash, err := auth.Hash(*password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	role := domain.RoleUser
	if *admin {
		role = domain.RoleAdmin
	}

	u := &domain.User{
		Email:        normEmail,
		PasswordHash: passwordHash,
		FullName:     strings.TrimSpace(*fullName),
		IsActive:     true,
		GlobalRole:   role,
	}
	if err := usersRepo.Create(ctx, u); err != nil {
		return err
	}

	fmt.Printf("user created: %s (admin=%t)\n", u.Email, u.IsAdmin())
	return nil
}

func runResetPassword(ctx context.Context, usersRepo *storage.UsersRepo, args []string) error {
	fs := flag.NewFlagSet("reset-password", flag.ContinueOnError)
	email := fs.String("email", "", "user email")
	password := fs.String("password", "", "new password")
	if err := fs.Parse(args); err != nil {
		return err
	}

	normEmail := strings.ToLower(strings.TrimSpace(*email))
	if normEmail == "" || strings.TrimSpace(*password) == "" {
		return fmt.Errorf("--email and --password are required")
	}

	u, err := usersRepo.GetByEmail(ctx, normEmail)
	if err != nil {
		return err
	}

	passwordHash, err := auth.Hash(*password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	if err := usersRepo.Update(ctx, u.ID, map[string]any{"password_hash": passwordHash}); err != nil {
		return err
	}

	fmt.Printf("password reset for: %s\n", u.Email)
	return nil
}

func runListUsers(ctx context.Context, usersRepo *storage.UsersRepo, args []string) error {
	fs := flag.NewFlagSet("list-users", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}

	users, total, err := usersRepo.List(ctx, 200, 0)
	if err != nil {
		return err
	}

	fmt.Printf("total users: %d\n", total)
	for _, u := range users {
		lastLogin := "-"
		if u.LastLoginAt != nil {
			lastLogin = u.LastLoginAt.Format(time.RFC3339)
		}
		fmt.Printf("- email=%s active=%t role=%d full_name=%q last_login=%s\n",
			u.Email, u.IsActive, u.GlobalRole, u.FullName, lastLogin)
	}
	return nil
}

func runDeactivate(ctx context.Context, usersRepo *storage.UsersRepo, args []string) error {
	fs := flag.NewFlagSet("deactivate", flag.ContinueOnError)
	email := fs.String("email", "", "user email")
	if err := fs.Parse(args); err != nil {
		return err
	}

	normEmail := strings.ToLower(strings.TrimSpace(*email))
	if normEmail == "" {
		return fmt.Errorf("--email is required")
	}

	u, err := usersRepo.GetByEmail(ctx, normEmail)
	if err != nil {
		return err
	}
	if err := usersRepo.Deactivate(ctx, u.ID); err != nil {
		return err
	}

	fmt.Printf("user deactivated: %s\n", u.Email)
	return nil
}

func usage() {
	fmt.Fprintln(os.Stderr, "Usage:")
	fmt.Fprintln(os.Stderr, "  /app/admin create-user --email=X --password=Y [--admin] [--full-name=...]")
	fmt.Fprintln(os.Stderr, "  /app/admin reset-password --email=X --password=Y")
	fmt.Fprintln(os.Stderr, "  /app/admin list-users")
	fmt.Fprintln(os.Stderr, "  /app/admin deactivate --email=X")
}
