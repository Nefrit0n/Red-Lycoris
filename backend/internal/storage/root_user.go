package storage

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const defaultRootEmail = "root@localhost"
const defaultRootPassword = "root"
const adminRoleName = "admin"

func EnsureRootUserExists(ctx context.Context, db *sql.DB, rootEmail string, rootPassword string) error {
	resolvedEmail := strings.TrimSpace(rootEmail)
	if resolvedEmail == "" {
		resolvedEmail = defaultRootEmail
	}
	resolvedPassword := rootPassword
	if strings.TrimSpace(resolvedPassword) == "" {
		resolvedPassword = defaultRootPassword
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, adminRoleName); err != nil {
		return err
	}

	var userID uuid.UUID
	var hasUser bool
	row := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = $1`, resolvedEmail)
	if scanErr := row.Scan(&userID); scanErr != nil {
		if scanErr != sql.ErrNoRows {
			return scanErr
		}
	} else {
		hasUser = true
	}

	if !hasUser {
		hashed, hashErr := bcrypt.GenerateFromPassword([]byte(resolvedPassword), bcrypt.DefaultCost)
		if hashErr != nil {
			return hashErr
		}

		insertRow := tx.QueryRowContext(
			ctx,
			`INSERT INTO users (username, email, hashed_password, password_changed)
			 VALUES ($1, $2, $3, FALSE)
			 RETURNING id`,
			"root",
			resolvedEmail,
			string(hashed),
		)
		if scanErr := insertRow.Scan(&userID); scanErr != nil {
			return scanErr
		}
	}

	if _, err = tx.ExecContext(
		ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, r.id FROM roles r WHERE r.name = $2
		 ON CONFLICT DO NOTHING`,
		userID,
		adminRoleName,
	); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}
