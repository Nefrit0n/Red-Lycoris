package storage

import (
	"context"
	"database/sql"
	"encoding/json"

	"lotus-warden/backend/internal/models"
)

func ExampleCRUD(ctx context.Context, db *sql.DB) error {
	productDescription := "Core API security scanner"
	product := &models.Product{
		Name:        "Lotus Warden",
		Slug:        "lotus-warden",
		Description: &productDescription,
	}
	if err := CreateProduct(ctx, db, product); err != nil {
		return err
	}

	engagement := &models.Engagement{
		ProductID: product.ID,
		Status:    "running",
	}
	if err := CreateEngagement(ctx, db, engagement); err != nil {
		return err
	}

	report := json.RawMessage(`{"summary":"scan completed"}`)
	engagementID := engagement.ID
	scanResult := &models.ScanResult{
		EngagementID: &engagementID,
		Scanner:      "sast",
		RawReport:    report,
	}
	if err := CreateScanResult(ctx, db, scanResult); err != nil {
		return err
	}

	findingDescription := "SQL injection detected in login endpoint"
	finding := &models.Finding{
		ScanResultID: &scanResult.ID,
		Fingerprint:  "example-fingerprint",
		Title:        "SQL injection",
		Description:  &findingDescription,
		Severity:     "high",
		Status:       "new",
	}
	if err := CreateFinding(ctx, db, finding); err != nil {
		return err
	}

	return nil
}
