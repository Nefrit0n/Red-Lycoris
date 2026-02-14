package storage

import (
	"context"
	"testing"

	"red-lycoris/backend/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestGetEffectiveProductRoleTakesMaximum(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	tenantID := uuid.New()
	userID := uuid.New()
	productID := uuid.New()

	mock.ExpectQuery("SELECT role\\s+FROM product_user_roles").
		WithArgs(tenantID, userID, productID).
		WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("viewer"))

	mock.ExpectQuery("SELECT ptr.role").
		WithArgs(tenantID, userID, productID).
		WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("maintainer"))

	role, err := GetEffectiveProductRole(context.Background(), db, tenantID, userID, productID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != models.ProjectRoleMaintainer {
		t.Fatalf("expected maintainer, got %s", role)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
