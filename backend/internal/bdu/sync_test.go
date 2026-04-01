package bdu

import (
	"path/filepath"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestParseWorkbookPrefersComponentsSheet(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "vullist.xlsx")
	book := excelize.NewFile()
	defer book.Close()

	vulnSheet := book.GetSheetName(0)
	if err := book.SetSheetName(vulnSheet, "Уязвимости"); err != nil {
		t.Fatalf("rename default sheet: %v", err)
	}
	componentSheet := "Компоненты"
	if _, err := book.NewSheet(componentSheet); err != nil {
		t.Fatalf("create components sheet: %v", err)
	}

	if err := writeBDURow(book, "Уязвимости", 1, "Идентификатор", "Наименование", "Описание"); err != nil {
		t.Fatalf("write vuln header: %v", err)
	}
	if err := writeBDURow(book, "Уязвимости", 2, "BDU:2025-99999", "Уязвимость CVE-2025-99999", "Описание CVE-2025-99999"); err != nil {
		t.Fatalf("write vuln row: %v", err)
	}
	if err := writeBDURow(book, componentSheet, 1, "Идентификатор", "Наименование", "Описание"); err != nil {
		t.Fatalf("write components header: %v", err)
	}
	if err := writeBDURow(book, componentSheet, 2, "LIB-1.2.3", "pkg:generic/lib", "компонент без BDU идентификатора"); err != nil {
		t.Fatalf("write components row: %v", err)
	}
	if err := book.SaveAs(path); err != nil {
		t.Fatalf("save workbook: %v", err)
	}

	vulns, mappings, err := parseWorkbook(path)
	if err != nil {
		t.Fatalf("parse workbook: %v", err)
	}
	if len(vulns) != 0 {
		t.Fatalf("expected no vulnerabilities from components sheet, got %d", len(vulns))
	}
	if len(mappings) != 0 {
		t.Fatalf("expected no identifier mappings from components sheet, got %d", len(mappings))
	}
}

func TestPreferredSheets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		sheets []string
		want   []string
	}{
		{
			name:   "prefer russian components",
			sheets: []string{"Уязвимости", "Компоненты"},
			want:   []string{"Компоненты"},
		},
		{
			name:   "prefer english components",
			sheets: []string{"Vulnerabilities", "Components"},
			want:   []string{"Components"},
		},
		{
			name:   "fallback to all sheets when no preferred",
			sheets: []string{"Sheet1", "Sheet2"},
			want:   []string{"Sheet1", "Sheet2"},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := preferredSheets(tt.sheets)
			if len(got) != len(tt.want) {
				t.Fatalf("expected %d sheets, got %d", len(tt.want), len(got))
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Fatalf("sheet %d: expected %q, got %q", i, tt.want[i], got[i])
				}
			}
		})
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
