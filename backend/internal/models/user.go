package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID `db:"id"`
	Username       string    `db:"username"`
	Email          string    `db:"email"`
	HashedPassword string    `db:"hashed_password"`
	CreatedAt      time.Time `db:"created_at"`
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
