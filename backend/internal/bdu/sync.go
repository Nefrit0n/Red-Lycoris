package bdu

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"red-lycoris/backend/internal/storage"

	"github.com/xuri/excelize/v2"
)

const (
	DefaultXLSXPath = "/app/assets/bdu/vullist.xlsx"
)

var (
	idRegexp = regexp.MustCompile(`(?i)\b(?:CVE-\d{4}-\d+|CWE-\d+)\b`)
)

func SyncIfDue(ctx context.Context, db *sql.DB, xlsxPath string, now time.Time) error {
	status, err := storage.GetBDUSyncStatus(ctx, db)
	if err != nil {
		return err
	}
	if status == nil {
		return fmt.Errorf("bdu sync status row is missing")
	}
	interval := time.Duration(status.SyncIntervalHours) * time.Hour
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	if status.LastSyncedAt != nil && now.Before(status.LastSyncedAt.Add(interval)) {
		return nil
	}
	return SyncNow(ctx, db, xlsxPath, now)
}

func SyncNow(ctx context.Context, db *sql.DB, xlsxPath string, now time.Time) error {
	if strings.TrimSpace(xlsxPath) == "" {
		xlsxPath = DefaultXLSXPath
	}
	if _, err := os.Stat(xlsxPath); err != nil {
		_ = storage.MarkBDUSyncFailed(ctx, db, fmt.Sprintf("bdu xlsx file not found: %s", xlsxPath))
		return err
	}
	if err := storage.MarkBDUSyncStarted(ctx, db); err != nil {
		return err
	}

	vulns, mappings, err := parseWorkbook(xlsxPath)
	if err != nil {
		_ = storage.MarkBDUSyncFailed(ctx, db, err.Error())
		return err
	}
	if err := storage.ReplaceBDUDataset(ctx, db, vulns, mappings, now.UTC()); err != nil {
		_ = storage.MarkBDUSyncFailed(ctx, db, err.Error())
		return err
	}
	return nil
}

func parseWorkbook(path string) ([]storage.BDUVulnerability, []storage.BDUIdentifierMapping, error) {
	book, err := excelize.OpenFile(path)
	if err != nil {
		return nil, nil, err
	}
	defer book.Close()

	sheets := book.GetSheetList()
	if len(sheets) == 0 {
		return nil, nil, fmt.Errorf("xlsx has no sheets")
	}

	byBDU := make(map[string]storage.BDUVulnerability)
	mapSet := make(map[string]storage.BDUIdentifierMapping)

	sheetsToParse := preferredSheets(sheets)
	for _, sheet := range sheetsToParse {
		rows, err := book.GetRows(sheet)
		if err != nil {
			return nil, nil, fmt.Errorf("read rows from sheet %s: %w", sheet, err)
		}
		for idx, row := range rows {
			if idx == 0 {
				continue
			}
			v := vulnerabilityFromRow(row)
			if strings.TrimSpace(v.BDUID) == "" || !strings.HasPrefix(strings.ToUpper(v.BDUID), "BDU:") {
				continue
			}
			if _, exists := byBDU[v.BDUID]; !exists {
				byBDU[v.BDUID] = v
			}
			for _, ident := range extractIdentifiers(v) {
				key := ident + "|" + v.BDUID
				mapSet[key] = storage.BDUIdentifierMapping{Identifier: ident, BDUID: v.BDUID}
			}
		}
	}

	vulns := make([]storage.BDUVulnerability, 0, len(byBDU))
	for _, v := range byBDU {
		vulns = append(vulns, v)
	}
	mappings := make([]storage.BDUIdentifierMapping, 0, len(mapSet))
	for _, m := range mapSet {
		mappings = append(mappings, m)
	}
	return vulns, mappings, nil
}

func preferredSheets(sheets []string) []string {
	preferred := make([]string, 0, 1)
	for _, sheet := range sheets {
		normalized := strings.ToLower(strings.TrimSpace(sheet))
		if strings.Contains(normalized, "компонент") || strings.Contains(normalized, "component") {
			preferred = append(preferred, sheet)
		}
	}
	if len(preferred) > 0 {
		return preferred
	}
	return sheets
}

func vulnerabilityFromRow(row []string) storage.BDUVulnerability {
	field := func(i int) string {
		if i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	return storage.BDUVulnerability{
		BDUID:              field(0),
		Name:               field(1),
		Description:        field(2),
		Vendor:             field(3),
		SoftwareName:       field(4),
		SoftwareVersion:    field(5),
		SoftwareType:       field(6),
		OSHardware:         field(7),
		VulnClass:          field(8),
		DetectionDate:      field(9),
		CVSSV2:             field(10),
		CVSSV3:             field(11),
		CVSSV4:             field(12),
		Severity:           field(13),
		Remediation:        field(14),
		Status:             field(15),
		ExploitExists:      field(16),
		FixInfo:            field(17),
		SourceURLs:         field(18),
		OtherIDs:           field(19),
		OtherInfo:          field(20),
		IncidentInfo:       field(21),
		ExploitationMethod: field(22),
		FixMethod:          field(23),
		PublishedDate:      field(24),
		UpdatedDate:        field(25),
		Consequences:       field(26),
		VulnState:          field(27),
		CWEDescription:     field(28),
		CWEID:              field(29),
	}
}

func extractIdentifiers(v storage.BDUVulnerability) []string {
	joined := strings.Join([]string{v.OtherIDs, v.CWEID, v.CWEDescription, v.Name, v.Description}, " ")
	matches := idRegexp.FindAllString(joined, -1)
	if len(matches) == 0 {
		return nil
	}
	uniq := make(map[string]struct{}, len(matches))
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		id := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(m), " ", ""))
		if _, ok := uniq[id]; ok {
			continue
		}
		uniq[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
