package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                 uuid.UUID  `db:"id"`
	TenantID           uuid.UUID  `db:"tenant_id"`
	Username           string     `db:"username"`
	FullName           *string    `db:"full_name"`
	Email              string     `db:"email"`
	OrgRole            string     `db:"org_role"`
	Status             string     `db:"status"`
	LastLoginAt        *time.Time `db:"last_login_at"`
	DeactivatedAt      *time.Time `db:"deactivated_at"`
	HashedPassword     string     `db:"hashed_password"`
	PasswordChanged    bool       `db:"password_changed"`
	MustChangePassword bool       `db:"must_change_password"`
	CreatedAt          time.Time  `db:"created_at"`
}

func (u *User) Validate() error {
	if err := validateRequired(u.Username, "username"); err != nil {
		return err
	}
	if err := validateMinLen(u.Username, 3, "username"); err != nil {
		return err
	}
	if err := validateMaxLen(u.Username, 50, "username"); err != nil {
		return err
	}
	if err := validateRequired(u.Email, "email"); err != nil {
		return err
	}
	if err := validateEmail(u.Email); err != nil {
		return err
	}
	if err := validateRequired(u.HashedPassword, "hashed_password"); err != nil {
		return err
	}
	return nil
}

func (u *User) PrepareForInsert() {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now().UTC()
	}
}
