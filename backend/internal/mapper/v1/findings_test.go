package v1

import (
	"database/sql"
	"testing"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"
)

func TestFindingCategoryDetailsSCAFixedVersionNullable(t *testing.T) {
	detail := &storage.ScaFindingDetail{
		ComponentName:    "openssl",
		InstalledVersion: "1.0.0",
		FixedVersion:     sql.NullString{Valid: false},
		VulnerabilityID:  "CVE-2024-0001",
	}

	result := FindingCategoryDetails(models.CategorySCA, nil, detail)
	sca, ok := result.(*v1dto.FindingDetailsSCA)
	if !ok {
		t.Fatalf("expected FindingDetailsSCA, got %T", result)
	}
	if sca.FixedVersion != nil {
		t.Fatalf("expected fixedVersion to be nil when sql.NullString is invalid")
	}
}
