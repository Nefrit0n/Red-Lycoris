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
	scanResult := &models.ScanResult{
		EngagementID: engagement.ID,
		Scanner:      "sast",
		RawReport:    report,
	}
	if err := CreateScanResult(ctx, db, scanResult); err != nil {
		return err
	}

	findingDescription := "SQL injection detected in login endpoint"
	findingStatus := "open"
	finding := &models.Finding{
		ScanResultID: scanResult.ID,
		Title:        "SQL injection",
		Description:  &findingDescription,
		Severity:     "high",
		Status:       &findingStatus,
	}
	if err := CreateFinding(ctx, db, finding); err != nil {
		return err
	}

	return nil
}
