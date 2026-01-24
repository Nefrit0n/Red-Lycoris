package sbomindex

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
)

const (
	sbomIndexStatusProcessing = "processing"
	sbomIndexStatusDone       = "done"
	sbomIndexStatusFailed     = "failed"
)

func IndexSbom(ctx context.Context, db *sql.DB, store objectstore.Store, sbomID uuid.UUID) error {
	sbom, err := storage.GetSbomByID(ctx, db, sbomID)
	if err != nil {
		return err
	}
	if sbom == nil {
		return fmt.Errorf("sbom not found")
	}

	if err := storage.UpdateSbomIndexStatus(ctx, db, sbomID, sbomIndexStatusProcessing, nil, nil, 0, 0); err != nil {
		return err
	}

	payload, err := readSbomPayload(ctx, store, sbom.ObjectKey)
	if err != nil {
		return markSbomFailed(ctx, db, sbomID, err)
	}

	parseResult, err := ParseSBOM(sbom.Format, payload)
	if err != nil {
		return markSbomFailed(ctx, db, sbomID, err)
	}

	componentCount, edgeCount, err := upsertInventory(ctx, db, sbomID, parseResult)
	if err != nil {
		return markSbomFailed(ctx, db, sbomID, err)
	}

	indexedAt := time.Now().UTC()
	if err := storage.UpdateSbomIndexStatus(ctx, db, sbomID, sbomIndexStatusDone, &indexedAt, nil, componentCount, edgeCount); err != nil {
		return err
	}
	return nil
}

func readSbomPayload(ctx context.Context, store objectstore.Store, objectKey string) ([]byte, error) {
	reader, err := store.GetObject(ctx, objectKey)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	payload, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, errors.New("sbom payload empty")
	}
	return payload, nil
}

func upsertInventory(ctx context.Context, db *sql.DB, sbomID uuid.UUID, result ParseResult) (int, int, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `DELETE FROM sbom_edges WHERE sbom_id = $1`, sbomID); err != nil {
		return 0, 0, fmt.Errorf("delete sbom edges failed: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM sbom_component_occurrences WHERE sbom_id = $1`, sbomID); err != nil {
		return 0, 0, fmt.Errorf("delete sbom component occurrences failed: %w", err)
	}

	componentIDs := make(map[string]uuid.UUID)
	componentIndex := make(map[string]uuid.UUID)

	for _, comp := range result.Components {
		if strings.TrimSpace(comp.Name) == "" {
			continue
		}
		key := componentKey(comp)
		if existing, ok := componentIndex[key]; ok {
			if comp.BomRef != "" {
				componentIDs[comp.BomRef] = existing
			}
			continue
		}

		id, err := ensureComponent(ctx, tx, comp)
		if err != nil {
			return 0, 0, err
		}
		componentIndex[key] = id
		if comp.BomRef != "" {
			componentIDs[comp.BomRef] = id
		}
	}

	directSet := map[uuid.UUID]bool{}
	if result.RootRef != "" {
		for _, edge := range result.Edges {
			if edge.From != result.RootRef {
				continue
			}
			if id, ok := componentIDs[edge.To]; ok {
				directSet[id] = true
			}
		}
	}

	componentCount := 0
	inserted := map[string]bool{}
	for _, comp := range result.Components {
		if strings.TrimSpace(comp.Name) == "" {
			continue
		}
		id, ok := componentIndex[componentKey(comp)]
		if !ok {
			continue
		}
		versionValue := strings.TrimSpace(comp.Version)
		occKey := fmt.Sprintf("%s|%s", id.String(), strings.ToLower(versionValue))
		if inserted[occKey] {
			continue
		}

		var licensesJSON []byte
		if len(comp.Licenses) > 0 {
			licensesJSON, _ = json.Marshal(comp.Licenses)
		}

		direct := false
		if directSet[id] {
			direct = true
		}

		if _, err := tx.ExecContext(ctx, `INSERT INTO sbom_component_occurrences (sbom_id, component_id, version, direct, bom_ref, supplier, licenses, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
			ON CONFLICT (sbom_id, component_id, version)
			DO UPDATE SET direct = EXCLUDED.direct,
			              bom_ref = EXCLUDED.bom_ref,
			              supplier = COALESCE(EXCLUDED.supplier, sbom_component_occurrences.supplier),
			              licenses = COALESCE(EXCLUDED.licenses, sbom_component_occurrences.licenses)`,
			sbomID,
			id,
			versionValue,
			direct,
			nullableString(comp.BomRef),
			nullableString(comp.Supplier),
			nullableJSON(licensesJSON),
		); err != nil {
			return 0, 0, fmt.Errorf("insert sbom component occurrence failed: %w", err)
		}
		componentCount++
		inserted[occKey] = true
	}

	edgeCount := 0
	for _, edge := range result.Edges {
		fromID, okFrom := componentIDs[edge.From]
		toID, okTo := componentIDs[edge.To]
		if !okFrom || !okTo {
			continue
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO sbom_edges (sbom_id, from_component_id, to_component_id)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING`, sbomID, fromID, toID); err != nil {
			return 0, 0, fmt.Errorf("insert sbom edge failed: %w", err)
		}
		edgeCount++
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}

	return componentCount, edgeCount, nil
}

func ensureComponent(ctx context.Context, tx *sql.Tx, comp ComponentInput) (uuid.UUID, error) {
	if comp.Purl != "" {
		var id uuid.UUID
		err := tx.QueryRowContext(ctx, `INSERT INTO sca_components (purl, ecosystem, name, created_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (purl) WHERE purl IS NOT NULL
			DO UPDATE SET name = EXCLUDED.name, ecosystem = EXCLUDED.ecosystem
			RETURNING id`,
			comp.Purl,
			nullableString(comp.Ecosystem),
			comp.Name,
		).Scan(&id)
		if err != nil {
			return uuid.Nil, err
		}
		return id, nil
	}

	var id uuid.UUID
	err := tx.QueryRowContext(ctx, `INSERT INTO sca_components (purl, ecosystem, name, created_at)
		VALUES (NULL, $1, $2, NOW())
		ON CONFLICT (ecosystem, name) WHERE purl IS NULL
		DO UPDATE SET name = EXCLUDED.name
		RETURNING id`,
		nullableString(comp.Ecosystem),
		comp.Name,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func componentKey(comp ComponentInput) string {
	if comp.Purl != "" {
		return "purl:" + strings.ToLower(comp.Purl)
	}
	return fmt.Sprintf("eco:%s|%s", strings.ToLower(comp.Ecosystem), strings.ToLower(comp.Name))
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func nullableJSON(value []byte) any {
	if len(value) == 0 {
		return nil
	}
	return value
}

func markSbomFailed(ctx context.Context, db *sql.DB, sbomID uuid.UUID, err error) error {
	msg := err.Error()
	_ = storage.UpdateSbomIndexStatus(ctx, db, sbomID, sbomIndexStatusFailed, nil, &msg, 0, 0)
	return err
}
