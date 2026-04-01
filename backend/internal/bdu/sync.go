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
		if len(rows) == 0 {
			continue
		}
		columns := buildColumnMap(rows[0])
		if columns["bdu_id"] < 0 {
			continue
		}
		for idx, row := range rows {
			if idx == 0 {
				continue
			}
			v := vulnerabilityFromRow(row, columns)
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
	if len(sheets) == 0 {
		return nil
	}
	preferred := make([]string, 0, len(sheets))
	for _, sheet := range sheets {
		name := strings.ToLower(strings.TrimSpace(sheet))
		if strings.Contains(name, "уязв") || strings.Contains(name, "vuln") {
			preferred = append(preferred, sheet)
		}
	}
	if len(preferred) > 0 {
		return preferred
	}
	return sheets
}

func buildColumnMap(headerRow []string) map[string]int {
	columns := map[string]int{
		"bdu_id":              findHeaderColumn(headerRow, "идентификатор", "identifier", "bdu"),
		"name":                findVulnerabilityNameColumn(headerRow),
		"description":         findHeaderColumn(headerRow, "описание уязвимости", "описание", "vulnerability description", "description"),
		"vendor":              findHeaderColumn(headerRow, "вендор", "vendor"),
		"software_name":       findHeaderColumn(headerRow, "название по", "программного обеспечения", "software name", "product name"),
		"software_version":    findHeaderColumn(headerRow, "версия по", "версия", "software version", "version"),
		"software_type":       findHeaderColumn(headerRow, "тип по", "тип", "software type"),
		"os_hardware":         findHeaderColumn(headerRow, "наименование ос", "os", "аппаратной платформы", "platform"),
		"vuln_class":          findHeaderColumn(headerRow, "класс уязвимости", "vulnerability class"),
		"detection_date":      findHeaderColumn(headerRow, "дата выявления", "detection date"),
		"cvss2":               findHeaderColumn(headerRow, "cvss 2", "cvss2"),
		"cvss3":               findHeaderColumn(headerRow, "cvss 3", "cvss3"),
		"cvss4":               findHeaderColumn(headerRow, "cvss 4", "cvss4"),
		"severity":            findHeaderColumn(headerRow, "уровень опасности", "severity"),
		"remediation":         findHeaderColumn(headerRow, "меры по устранению", "remediation", "mitigation"),
		"status":              findHeaderColumn(headerRow, "статус уязвимости", "status"),
		"exploit_exists":      findHeaderColumn(headerRow, "наличие эксплойта", "exploit"),
		"fix_info":            findHeaderColumn(headerRow, "информация об устранении", "fix info"),
		"source_urls":         findHeaderColumn(headerRow, "ссылки на источники", "source", "references"),
		"other_ids":           findHeaderColumn(headerRow, "идентификаторы других систем", "other id"),
		"other_info":          findHeaderColumn(headerRow, "прочая информация", "other info"),
		"incident_info":       findHeaderColumn(headerRow, "инцидентами", "incident"),
		"exploitation_method": findHeaderColumn(headerRow, "способ эксплуатации", "exploitation method"),
		"fix_method":          findHeaderColumn(headerRow, "способ устранения", "fix method"),
		"published_date":      findHeaderColumn(headerRow, "дата публикации", "published date"),
		"updated_date":        findHeaderColumn(headerRow, "дата последнего обновления", "updated date", "last update"),
		"consequences":        findHeaderColumn(headerRow, "последствия эксплуатации", "consequences"),
		"vuln_state":          findHeaderColumn(headerRow, "состояние уязвимости", "vulnerability state"),
		"cwe_description":     findHeaderColumn(headerRow, "описание ошибки cwe", "cwe description"),
		"cwe_id":              findHeaderColumn(headerRow, "тип ошибки cwe", "cwe id"),
	}
	return columns
}

func findVulnerabilityNameColumn(headerRow []string) int {
	idx := findHeaderColumn(headerRow, "наименование уязвимости", "название уязвимости", "vulnerability name")
	if idx >= 0 {
		return idx
	}
	for i, raw := range headerRow {
		h := strings.ToLower(strings.TrimSpace(raw))
		if strings.Contains(h, "наименование") && !strings.Contains(h, "ос") {
			return i
		}
	}
	return findHeaderColumn(headerRow, "name")
}

func findHeaderColumn(headerRow []string, variants ...string) int {
	for idx, raw := range headerRow {
		header := strings.ToLower(strings.TrimSpace(raw))
		for _, variant := range variants {
			if strings.Contains(header, variant) {
				return idx
			}
		}
	}
	return -1
}

func vulnerabilityFromRow(row []string, columns map[string]int) storage.BDUVulnerability {
	field := func(key string) string {
		i := columns[key]
		if i >= 0 && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	return storage.BDUVulnerability{
		BDUID:              field("bdu_id"),
		Name:               field("name"),
		Description:        field("description"),
		Vendor:             field("vendor"),
		SoftwareName:       field("software_name"),
		SoftwareVersion:    field("software_version"),
		SoftwareType:       field("software_type"),
		OSHardware:         field("os_hardware"),
		VulnClass:          field("vuln_class"),
		DetectionDate:      field("detection_date"),
		CVSSV2:             field("cvss2"),
		CVSSV3:             field("cvss3"),
		CVSSV4:             field("cvss4"),
		Severity:           field("severity"),
		Remediation:        field("remediation"),
		Status:             field("status"),
		ExploitExists:      field("exploit_exists"),
		FixInfo:            field("fix_info"),
		SourceURLs:         field("source_urls"),
		OtherIDs:           field("other_ids"),
		OtherInfo:          field("other_info"),
		IncidentInfo:       field("incident_info"),
		ExploitationMethod: field("exploitation_method"),
		FixMethod:          field("fix_method"),
		PublishedDate:      field("published_date"),
		UpdatedDate:        field("updated_date"),
		Consequences:       field("consequences"),
		VulnState:          field("vuln_state"),
		CWEDescription:     field("cwe_description"),
		CWEID:              field("cwe_id"),
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
