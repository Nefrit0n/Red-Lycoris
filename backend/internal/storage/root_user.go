package storage

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const adminRoleName = "admin"

// systemTenantID is a well-known tenant UUID assigned to the root user.
// This must not be uuid.Nil, otherwise the login handler rejects the user.
var systemTenantID = uuid.MustParse("10000000-0000-0000-0000-000000000001")

var ErrMissingRootCredentials = errors.New("root email and password are required")

// EnsureRootUserExists creates or updates the root admin user.
// Both rootEmail and rootPassword must be provided - no defaults are used.
func EnsureRootUserExists(ctx context.Context, db *sql.DB, rootEmail string, rootPassword string) error {
	resolvedEmail := strings.TrimSpace(rootEmail)
	resolvedPassword := strings.TrimSpace(rootPassword)

	if resolvedEmail == "" || resolvedPassword == "" {
		return ErrMissingRootCredentials
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
	var existingEmail string
	var existingHashedPassword string
	var passwordChanged bool
	var mustChangePassword bool
	row := tx.QueryRowContext(ctx, `SELECT id, email, hashed_password, password_changed, must_change_password FROM users WHERE email = $1`, resolvedEmail)
	if scanErr := row.Scan(&userID, &existingEmail, &existingHashedPassword, &passwordChanged, &mustChangePassword); scanErr != nil {
		if scanErr != sql.ErrNoRows {
			return scanErr
		}
	} else {
		hasUser = true
	}

	if !hasUser {
		usernameRow := tx.QueryRowContext(ctx, `SELECT id, email, hashed_password, password_changed, must_change_password FROM users WHERE username = $1`, "root")
		if scanErr := usernameRow.Scan(&userID, &existingEmail, &existingHashedPassword, &passwordChanged, &mustChangePassword); scanErr != nil {
			if scanErr != sql.ErrNoRows {
				return scanErr
			}
		} else {
			hasUser = true
		}
	}

	if !hasUser {
		hashed, hashErr := bcrypt.GenerateFromPassword([]byte(resolvedPassword), bcrypt.DefaultCost)
		if hashErr != nil {
			return hashErr
		}

		insertRow := tx.QueryRowContext(
			ctx,
			`INSERT INTO users (username, email, hashed_password, password_changed, must_change_password, tenant_id)
			 VALUES ($1, $2, $3, FALSE, TRUE, $4)
			 RETURNING id`,
			"root",
			resolvedEmail,
			string(hashed),
			systemTenantID,
		)
		if scanErr := insertRow.Scan(&userID); scanErr != nil {
			return scanErr
		}
	} else {
		if existingEmail != "" && existingEmail != resolvedEmail {
			if _, err = tx.ExecContext(ctx, `UPDATE users SET email = $1 WHERE id = $2`, resolvedEmail, userID); err != nil {
				return err
			}
		}

		if !passwordChanged && existingHashedPassword != "" {
			if err = bcrypt.CompareHashAndPassword([]byte(existingHashedPassword), []byte(resolvedPassword)); err != nil {
				hashed, hashErr := bcrypt.GenerateFromPassword([]byte(resolvedPassword), bcrypt.DefaultCost)
				if hashErr != nil {
					return hashErr
				}
				if _, err = tx.ExecContext(ctx, `UPDATE users SET hashed_password = $1, password_changed = FALSE, must_change_password = TRUE WHERE id = $2`, string(hashed), userID); err != nil {
					return err
				}
			}
		}

		if !passwordChanged && !mustChangePassword {
			if _, err = tx.ExecContext(ctx, `UPDATE users SET must_change_password = TRUE WHERE id = $1`, userID); err != nil {
				return err
			}
		}

		// Fix existing root users that have nil tenant_id (causes 403 on login)
		if _, err = tx.ExecContext(ctx,
			`UPDATE users SET tenant_id = $1 WHERE id = $2 AND tenant_id = '00000000-0000-0000-0000-000000000000'`,
			systemTenantID, userID,
		); err != nil {
			return err
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
