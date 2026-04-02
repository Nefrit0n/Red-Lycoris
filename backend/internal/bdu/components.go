package bdu

import (
	"fmt"
	"strings"

	"red-lycoris/backend/internal/storage"

	"github.com/xuri/excelize/v2"
)

// parseComponentsSheet reads the "Компоненты" sheet from the BDU XLSX file
// and returns a slice of BDUComponent records linking BDU IDs to specific software.
func parseComponentsSheet(xlsxPath string) ([]storage.BDUComponent, error) {
	book, err := excelize.OpenFile(xlsxPath)
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	defer book.Close()

	sheetName := findComponentsSheet(book.GetSheetList())
	if sheetName == "" {
		return nil, nil // no components sheet — not an error
	}

	rows, err := book.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("read rows from sheet %s: %w", sheetName, err)
	}
	if len(rows) < 2 {
		return nil, nil
	}

	headerRowIdx := detectHeaderRow(rows)
	if headerRowIdx < 0 {
		return nil, fmt.Errorf("components sheet %q: header row not found", sheetName)
	}
	columns := buildComponentColumnMap(rows[headerRowIdx])
	if columns["bdu_id"] < 0 {
		return nil, fmt.Errorf("components sheet %q: bdu_id column not found", sheetName)
	}
	if columns["software_name"] < 0 {
		return nil, fmt.Errorf("components sheet %q: software_name column not found", sheetName)
	}

	seen := make(map[string]struct{})
	var result []storage.BDUComponent

	for i := headerRowIdx + 1; i < len(rows); i++ {
		row := rows[i]
		comp := componentFromRow(row, columns)
		if strings.TrimSpace(comp.BDUID) == "" || !strings.HasPrefix(strings.ToUpper(comp.BDUID), "BDU:") {
			continue
		}
		if strings.TrimSpace(comp.SoftwareName) == "" {
			continue
		}

		// Deduplicate by (bdu_id, software_name, software_version)
		key := comp.BDUID + "|" + strings.ToLower(comp.SoftwareName) + "|" + strings.ToLower(comp.SoftwareVersion)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, comp)
	}

	return result, nil
}

// findComponentsSheet returns the first sheet name containing component keywords.
func findComponentsSheet(sheets []string) string {
	for _, s := range sheets {
		name := strings.ToLower(s)
		if strings.Contains(name, "компонент") || strings.Contains(name, "component") {
			return s
		}
	}
	return ""
}

// buildComponentColumnMap maps logical column names to indices for the components sheet.
func buildComponentColumnMap(headerRow []string) map[string]int {
	return map[string]int{
		"bdu_id":           findHeaderColumn(headerRow, "идентификатор", "identifier", "bdu"),
		"vendor":           findHeaderColumn(headerRow, "вендор", "vendor", "производитель"),
		"software_name":    findSoftwareNameColumn(headerRow),
		"software_version": findHeaderColumn(headerRow, "версия по", "версия", "software version", "version"),
		"software_type":    findHeaderColumn(headerRow, "тип по", "тип программного", "software type", "тип"),
		"os_platform":      findHeaderColumn(headerRow, "наименование ос", "платформ", "os", "platform"),
	}
}

func findSoftwareNameColumn(headerRow []string) int {
	idx := findHeaderColumn(
		headerRow,
		"название по",
		"наименование по",
		"название программного",
		"наименование программного",
		"программного обеспечения",
		"software name",
		"product name",
		"component name",
	)
	if idx >= 0 {
		return idx
	}
	for i, raw := range headerRow {
		h := strings.ToLower(strings.TrimSpace(raw))
		if strings.Contains(h, "по") && (strings.Contains(h, "наименование") || strings.Contains(h, "название")) {
			return i
		}
	}
	return findHeaderColumn(headerRow, "наименование", "название", "name")
}

// componentFromRow extracts a BDUComponent from a single row using the column map.
func componentFromRow(row []string, columns map[string]int) storage.BDUComponent {
	field := func(key string) string {
		i := columns[key]
		if i >= 0 && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	return storage.BDUComponent{
		BDUID:           field("bdu_id"),
		Vendor:          field("vendor"),
		SoftwareName:    field("software_name"),
		SoftwareVersion: field("software_version"),
		SoftwareType:    field("software_type"),
		OSPlatform:      field("os_platform"),
	}
}
