package storage

import (
	"context"
	"database/sql"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

func GetUserByEmail(ctx context.Context, db *sql.DB, email string) (*models.User, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, username, email, hashed_password, created_at
		 FROM users WHERE email = $1`,
		email,
	)

	var user models.User
	if err := row.Scan(&user.ID, &user.Username, &user.Email, &user.HashedPassword, &user.CreatedAt); err != nil {
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
