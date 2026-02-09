package storage

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

type ImportJobListItem struct {
	ID                uuid.UUID
	TenantID          uuid.NullUUID
	Scanner           string
	SourceType        sql.NullString
	SourceVersion     sql.NullString
	Status            string
	FindingsTotal     int
	FindingsNew       int
	DuplicatesTotal   int
	GateFailed        bool
	Checksum          string
	CreatedAt         time.Time
	StartedAt         sql.NullTime
	FinishedAt        sql.NullTime
	ProductID         uuid.NullUUID
	ProductName       sql.NullString
	ProductVersion    sql.NullString
	ProductIdentifier sql.NullString
	CreatedBy         uuid.NullUUID
}

type ImportJobDetail struct {
	ImportJobListItem
	ErrorMessage sql.NullString
}

func CreateImportJob(ctx context.Context, db *sql.DB, job *models.ImportJob) error {
	if err := job.Validate(); err != nil {
		return err
	}
	job.PrepareForInsert()

	var productID interface{}
	if job.ProductID != nil {
		productID = *job.ProductID
	}
	var productName sql.NullString
	if job.ProductName != nil {
		productName = sql.NullString{String: *job.ProductName, Valid: true}
	}
	var productVersion sql.NullString
	if job.ProductVersion != nil {
		productVersion = sql.NullString{String: *job.ProductVersion, Valid: true}
	}
	var productIdentifier sql.NullString
	if job.ProductIdentifier != nil {
		productIdentifier = sql.NullString{String: *job.ProductIdentifier, Valid: true}
	}
	var createdBy interface{}
	if job.CreatedBy != nil {
		createdBy = *job.CreatedBy
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO import_jobs (id, tenant_id, scanner, source_type, source_version, product_id, product_name, product_version, product_identifier, status, findings_total, findings_new, duplicates_total, gate_failed, checksum, error_message, created_at, started_at, finished_at, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
		job.ID,
		anyUUIDPtr(job.TenantID),
		job.Scanner,
		anyStringPtr(job.SourceType),
		anyStringPtr(job.SourceVersion),
		productID,
		productName,
		productVersion,
		productIdentifier,
		job.Status,
		job.FindingsTotal,
		job.FindingsNew,
		job.DuplicatesTotal,
		job.GateFailed,
		job.Checksum,
		job.ErrorMessage,
		job.CreatedAt,
		job.StartedAt,
		job.FinishedAt,
		createdBy,
	)
	return err
}

func GetImportJobByChecksum(ctx context.Context, db *sql.DB, checksum string) (*ImportJobDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, scanner, source_type, source_version, status, findings_total, findings_new, duplicates_total, gate_failed, checksum, created_at, started_at, finished_at, product_id, product_name, product_version, product_identifier, created_by, error_message
		 FROM import_jobs
		 WHERE checksum = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		checksum,
	)
	return scanImportJobDetail(row)
}

func UpdateImportJobStatus(ctx context.Context, db *sql.DB, id uuid.UUID, status string, startedAt *time.Time, finishedAt *time.Time, errorMessage *string) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE import_jobs
		 SET status = $1,
		     started_at = COALESCE($2, started_at),
		     finished_at = COALESCE($3, finished_at),
		     error_message = $4
		 WHERE id = $5`,
		status,
		startedAt,
		finishedAt,
		errorMessage,
		id,
	)
	return err
}

func UpdateImportJobGateFailed(ctx context.Context, db *sql.DB, id uuid.UUID, gateFailed bool) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE import_jobs
		 SET gate_failed = $1
		 WHERE id = $2`,
		gateFailed,
		id,
	)
	return err
}

func UpdateImportJobProductID(ctx context.Context, db *sql.DB, id uuid.UUID, productID uuid.UUID) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE import_jobs
		 SET product_id = $1
		 WHERE id = $2`,
		productID,
		id,
	)
	return err
}

func UpdateImportJobStats(ctx context.Context, db *sql.DB, id uuid.UUID, findingsTotal int, findingsNew int, duplicates int) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE import_jobs
		 SET findings_total = $1,
		     findings_new = $2,
		     duplicates_total = $3
		 WHERE id = $4`,
		findingsTotal,
		findingsNew,
		duplicates,
		id,
	)
	return err
}

type ImportJobFilters struct {
	TenantID  *uuid.UUID
	ProductID *uuid.UUID
	Scanner   string
	Status    string
	Limit     int
	Offset    int
}

func ListImportJobs(ctx context.Context, db *sql.DB, filters ImportJobFilters) ([]ImportJobListItem, int, error) {
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	if filters.TenantID != nil {
		args = append(args, *filters.TenantID)
		whereClause += " AND tenant_id = $" + itoa(len(args))
	}
	if filters.ProductID != nil {
		args = append(args, *filters.ProductID)
		whereClause += " AND product_id = $" + itoa(len(args))
	}
	if filters.Scanner != "" {
		args = append(args, filters.Scanner)
		whereClause += " AND scanner = $" + itoa(len(args))
	}
	if filters.Status != "" {
		args = append(args, filters.Status)
		whereClause += " AND status = $" + itoa(len(args))
	}

	var total int
	var countBuilder strings.Builder
	countBuilder.WriteString("SELECT COUNT(*) FROM import_jobs ")
	countBuilder.WriteString(whereClause)
	countQuery := countBuilder.String()
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	var listBuilder strings.Builder
	listBuilder.WriteString(`SELECT id, tenant_id, scanner, source_type, source_version, status, findings_total, findings_new, duplicates_total, gate_failed, checksum, created_at, started_at, finished_at, product_id, product_name, product_version, product_identifier, created_by
		 FROM import_jobs
		 `)
	listBuilder.WriteString(whereClause)
	listBuilder.WriteString(`
		 ORDER BY created_at DESC
		 LIMIT $`)
	listBuilder.WriteString(itoa(len(args) - 1))
	listBuilder.WriteString(` OFFSET $`)
	listBuilder.WriteString(itoa(len(args)))
	rows, err := db.QueryContext(
		ctx,
		listBuilder.String(),
		args...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []ImportJobListItem{}
	for rows.Next() {
		var item ImportJobListItem
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.Scanner,
			&item.SourceType,
			&item.SourceVersion,
			&item.Status,
			&item.FindingsTotal,
			&item.FindingsNew,
			&item.DuplicatesTotal,
			&item.GateFailed,
			&item.Checksum,
			&item.CreatedAt,
			&item.StartedAt,
			&item.FinishedAt,
			&item.ProductID,
			&item.ProductName,
			&item.ProductVersion,
			&item.ProductIdentifier,
			&item.CreatedBy,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetImportJobByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*ImportJobDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, scanner, source_type, source_version, status, findings_total, findings_new, duplicates_total, gate_failed, checksum, created_at, started_at, finished_at, product_id, product_name, product_version, product_identifier, created_by, error_message
		 FROM import_jobs
		 WHERE id = $1`,
		id,
	)
	return scanImportJobDetail(row)
}

func scanImportJobDetail(row *sql.Row) (*ImportJobDetail, error) {
	var item ImportJobDetail
	if err := row.Scan(
		&item.ID,
		&item.TenantID,
		&item.Scanner,
		&item.SourceType,
		&item.SourceVersion,
		&item.Status,
		&item.FindingsTotal,
		&item.FindingsNew,
		&item.DuplicatesTotal,
		&item.GateFailed,
		&item.Checksum,
		&item.CreatedAt,
		&item.StartedAt,
		&item.FinishedAt,
		&item.ProductID,
		&item.ProductName,
		&item.ProductVersion,
		&item.ProductIdentifier,
		&item.CreatedBy,
		&item.ErrorMessage,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func itoa(value int) string {
	return strconv.Itoa(value)
}
