package storage

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestGetFindingNeighbors_CategoriesFilterUsesCurrentIDPlaceholder(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	tenantID := uuid.New()
	currentID := uuid.New()
	now := time.Now().UTC()

	filters := FindingFilters{
		TenantID:   &tenantID,
		Categories: []string{"sast"},
	}

	currentQueryPattern := regexp.QuoteMeta(`
		SELECT COALESCE(f.last_seen_at, f.created_at)
		` + findingBaseJoins + `
		WHERE ` + findingFilterWhereClause + ` AND f.id = $17`)
	mock.ExpectQuery(currentQueryPattern).
		WithArgs(
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			currentID,
		).
		WillReturnRows(sqlmock.NewRows([]string{"sort_key"}).AddRow(now))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT f.id
		` + findingBaseJoins + `
		WHERE ` + findingFilterWhereClause + `
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) > ($16, $17)
		ORDER BY COALESCE(f.last_seen_at, f.created_at) DESC, f.id DESC
		LIMIT 1`)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT f.id
		` + findingBaseJoins + `
		WHERE ` + findingFilterWhereClause + `
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) < ($16, $17)
		ORDER BY COALESCE(f.last_seen_at, f.created_at) DESC, f.id DESC
		LIMIT 1`)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(*)
		` + findingBaseJoins + `
		WHERE ` + findingFilterWhereClause + `
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) > ($16, $17)`)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) ` + findingBaseJoins + ` WHERE ` + findingFilterWhereClause)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	res, err := GetFindingNeighbors(context.Background(), db, currentID, filters)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.Position != 1 {
		t.Fatalf("expected position=1, got %d", res.Position)
	}
	if res.Total != 1 {
		t.Fatalf("expected total=1, got %d", res.Total)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
