package transitive

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"
)

const (
	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusDone       = "done"
	StatusFailed     = "failed"
)

type Pipeline struct {
	client    *OsvClient
	maxDepths []int
}

func NewPipeline(client *OsvClient, maxDepths []int) *Pipeline {
	depths := make([]int, 0, len(maxDepths))
	seen := map[int]struct{}{}
	for _, d := range maxDepths {
		if d <= 0 || d > 100 {
			continue
		}
		if _, ok := seen[d]; ok {
			continue
		}
		seen[d] = struct{}{}
		depths = append(depths, d)
	}
	if len(depths) == 0 {
		depths = []int{25}
	}

	return &Pipeline{client: client, maxDepths: depths}
}

func (p *Pipeline) Run(ctx context.Context, db *sql.DB, sbomID uuid.UUID) error {
	sbom, err := storage.GetSbomByID(ctx, db, sbomID)
	if err != nil {
		return err
	}
	if sbom == nil {
		return fmt.Errorf("sbom not found")
	}

	// Support CycloneDX and all SPDX formats (JSON and tag-value)
	switch sbom.Format {
	case models.SbomFormatCycloneDX, models.SbomFormatSPDXJSON, models.SbomFormatSPDX:
		// Supported formats
	default:
		return p.fail(ctx, db, sbomID, fmt.Sprintf("transitive analysis supports CycloneDX and SPDX formats, got: %s", sbom.Format))
	}

	if err := storage.UpdateSbomTransitiveStatus(ctx, db, sbomID, StatusProcessing, nil, nil); err != nil {
		return err
	}

	// Note: The transitive exposure query handles cases with and without edges correctly.
	// When EdgeCount == 0, the recursive CTE simply won't expand beyond direct components,
	// but we still get vulnerability data for direct dependencies.

	components, err := storage.ListSbomOsvComponents(ctx, db, sbomID)
	if err != nil {
		return p.fail(ctx, db, sbomID, err.Error())
	}

	inputs := make([]OsvComponent, 0, len(components))
	for _, comp := range components {
		inputs = append(inputs, OsvComponent{
			ComponentID: comp.ComponentID,
			Purl:        comp.Purl,
			Version:     comp.Version,
		})
	}

	vulnRecords := make([]storage.SbomComponentVulnRecord, 0)
	if len(inputs) > 0 {
		vulns, err := p.client.QueryComponents(ctx, inputs)
		if err != nil {
			if errors.Is(err, ErrOsvUnreachable) {
				return p.fail(ctx, db, sbomID, "osv unreachable")
			}
			return p.fail(ctx, db, sbomID, err.Error())
		}
		for _, v := range vulns {
			vulnRecords = append(vulnRecords, storage.SbomComponentVulnRecord{
				ComponentID:  v.ComponentID,
				Identifier:   v.Identifier,
				Severity:     v.Severity,
				CvssScore:    v.CvssScore,
				EpssScore:    v.EpssScore,
				FixedVersion: v.FixedVersion,
				Source:       v.Source,
			})
		}
	}

	if err := storage.ReplaceSbomComponentVulns(ctx, db, sbomID, vulnRecords); err != nil {
		return p.fail(ctx, db, sbomID, err.Error())
	}

	for _, depth := range p.maxDepths {
		if err := storage.RefreshSbomTransitiveExposure(ctx, db, sbomID, depth); err != nil {
			return p.fail(ctx, db, sbomID, err.Error())
		}
	}

	updatedAt := time.Now().UTC()
	if err := storage.UpdateSbomTransitiveStatus(ctx, db, sbomID, StatusDone, &updatedAt, nil); err != nil {
		return err
	}
	return nil
}

func (p *Pipeline) fail(ctx context.Context, db *sql.DB, sbomID uuid.UUID, msg string) error {
	updatedAt := time.Now().UTC()
	_ = storage.UpdateSbomTransitiveStatus(ctx, db, sbomID, StatusFailed, &updatedAt, &msg)
	return errors.New(msg)
}
