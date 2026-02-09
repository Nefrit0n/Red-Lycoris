package storage

import (
	"context"
	"database/sql"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

func GetUserByEmail(ctx context.Context, db *sql.DB, email string) (*models.User, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, username, email, hashed_password, password_changed, must_change_password, created_at
		 FROM users
		 WHERE email = $1`,
		email,
	)

	var user models.User
	if err := row.Scan(
		&user.ID,
		&user.TenantID,
		&user.Username,
		&user.Email,
		&user.HashedPassword,
		&user.PasswordChanged,
		&user.MustChangePassword,
		&user.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func GetUserByLogin(ctx context.Context, db *sql.DB, email string, username string) (*models.User, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, username, email, hashed_password, password_changed, must_change_password, created_at
		 FROM users
		 WHERE email = $1 OR username = $2`,
		email,
		username,
	)

	var user models.User
	if err := row.Scan(
		&user.ID,
		&user.TenantID,
		&user.Username,
		&user.Email,
		&user.HashedPassword,
		&user.PasswordChanged,
		&user.MustChangePassword,
		&user.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func GetUserByID(ctx context.Context, db *sql.DB, userID uuid.UUID) (*models.User, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, username, email, hashed_password, password_changed, must_change_password, created_at
		 FROM users
		 WHERE id = $1`,
		userID,
	)

	var user models.User
	if err := row.Scan(
		&user.ID,
		&user.TenantID,
		&user.Username,
		&user.Email,
		&user.HashedPassword,
		&user.PasswordChanged,
		&user.MustChangePassword,
		&user.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func GetUserRoles(ctx context.Context, db *sql.DB, userID uuid.UUID) ([]string, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT r.name
		 FROM user_roles ur
		 JOIN roles r ON r.id = ur.role_id
		 WHERE ur.user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := []string{}
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return roles, nil
}

func UpdateUserPassword(
	ctx context.Context,
	db *sql.DB,
	userID uuid.UUID,
	hashedPassword string,
	passwordChanged bool,
	mustChangePassword bool,
) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE users
		 SET hashed_password = $1,
		     password_changed = $2,
		     must_change_password = $3
		 WHERE id = $4`,
		hashedPassword,
		passwordChanged,
		mustChangePassword,
		userID,
	)
	return err
}

func UserExists(ctx context.Context, db *sql.DB, userID uuid.UUID) (bool, error) {
	var exists bool
	err := db.QueryRowContext(
		ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)`,
		userID,
	).Scan(&exists)
	return exists, err
}
