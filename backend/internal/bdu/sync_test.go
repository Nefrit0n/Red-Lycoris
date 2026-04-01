package bdu

import (
	"path/filepath"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestParseWorkbookUsesHeaderBasedParsing(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "vullist.xlsx")
	book := excelize.NewFile()
	defer book.Close()

	firstSheet := book.GetSheetName(0)
	if err := book.SetSheetName(firstSheet, "Уязвимости"); err != nil {
		t.Fatalf("rename default sheet: %v", err)
	}
	if _, err := book.NewSheet("Компоненты"); err != nil {
		t.Fatalf("create second sheet: %v", err)
	}

	if err := writeBDURow(book, "Уязвимости", 1, "Идентификатор", "Наименование уязвимости", "Описание уязвимости"); err != nil {
		t.Fatalf("write vuln header: %v", err)
	}
	if err := writeBDURow(book, "Уязвимости", 2, "BDU:2025-99999", "Уязвимость CVE-2025-99999", "Описание CVE-2025-99999 CVE-2025-99999"); err != nil {
		t.Fatalf("write vuln row: %v", err)
	}
	if err := book.SaveAs(path); err != nil {
		t.Fatalf("save workbook: %v", err)
	}

	vulns, mappings, err := parseWorkbook(path)
	if err != nil {
		t.Fatalf("parse workbook: %v", err)
	}
	if len(vulns) != 1 {
		t.Fatalf("expected 1 vulnerability from header-based parsing, got %d", len(vulns))
	}
	if len(mappings) != 1 {
		t.Fatalf("expected 1 identifier mapping, got %d", len(mappings))
	}
	if mappings[0].Identifier != "CVE-2025-99999" {
		t.Fatalf("expected CVE identifier from description, got %q", mappings[0].Identifier)
	}
}

func TestBuildColumnMapSupportsHeaderVariants(t *testing.T) {
	t.Parallel()

	header := []string{
		"Идентификатор",
		"Наименование уязвимости",
		"Описание уязвимости",
		"Идентификаторы других систем описаний уязвимости",
		"Описание ошибки CWE",
		"Тип ошибки CWE",
	}

	columns := buildColumnMap(header)
	if columns["bdu_id"] != 0 {
		t.Fatalf("expected bdu_id column at index 0, got %d", columns["bdu_id"])
	}
	if columns["name"] != 1 {
		t.Fatalf("expected name column at index 1, got %d", columns["name"])
	}
	if columns["description"] != 2 {
		t.Fatalf("expected description column at index 2, got %d", columns["description"])
	}
	if columns["other_ids"] != 3 {
		t.Fatalf("expected other_ids column at index 3, got %d", columns["other_ids"])
	}
	if columns["cwe_description"] != 4 {
		t.Fatalf("expected cwe_description column at index 4, got %d", columns["cwe_description"])
	}
	if columns["cwe_id"] != 5 {
		t.Fatalf("expected cwe_id column at index 5, got %d", columns["cwe_id"])
	}
}

func TestBuildColumnMapUsesPrimaryVulnerabilityColumnsWhenDuplicated(t *testing.T) {
	t.Parallel()

	header := []string{
		"Идентификатор",
		"Наименование уязвимости",
		"Описание уязвимости",
		"Наименование ОС и тип аппаратной платформы",
		"Идентификатор",
		"Наименование",
	}

	columns := buildColumnMap(header)
	if columns["bdu_id"] != 0 {
		t.Fatalf("expected first identifier column at index 0, got %d", columns["bdu_id"])
	}
	if columns["name"] != 1 {
		t.Fatalf("expected vulnerability name column at index 1, got %d", columns["name"])
	}
}

func writeBDURow(book *excelize.File, sheet string, row int, values ...string) error {
	for idx, value := range values {
		cell, err := excelize.CoordinatesToCellName(idx+1, row)
		if err != nil {
			return err
		}
		if err := book.SetCellStr(sheet, cell, value); err != nil {
			return err
		}
	}
	return nil
}
