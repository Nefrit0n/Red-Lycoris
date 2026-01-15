package storage

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(db *sql.DB) error {
	path := os.Getenv("MIGRATIONS_PATH")
	log.Printf("RUN MIGRATIONS: MIGRATIONS_PATH=%q", path)

	if path == "" {
		return errors.New("MIGRATIONS_PATH is required")
	}

	if !strings.HasPrefix(path, "file://") {
		path = "file://" + path
	}

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithDatabaseInstance(path, "postgres", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}

	return nil
}
