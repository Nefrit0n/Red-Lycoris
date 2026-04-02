package bdu

import (
	"path/filepath"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestParseComponentsSheetSupportsNaimenovaniePOHeader(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "vullist.xlsx")
	book := excelize.NewFile()
	defer book.Close()

	firstSheet := book.GetSheetName(0)
	if err := book.SetSheetName(firstSheet, "Компоненты"); err != nil {
		t.Fatalf("rename default sheet: %v", err)
	}
	if err := writeBDURow(book, "Компоненты", 1, "Идентификатор", "Наименование ПО", "Версия ПО", "Вендор"); err != nil {
		t.Fatalf("write header row: %v", err)
	}
	if err := writeBDURow(book, "Компоненты", 2, "BDU:2026-00001", "OpenSSL", "1.1.1", "OpenSSL Team"); err != nil {
		t.Fatalf("write data row: %v", err)
	}
	if err := book.SaveAs(path); err != nil {
		t.Fatalf("save workbook: %v", err)
	}

	components, err := parseComponentsSheet(path)
	if err != nil {
		t.Fatalf("parse components sheet: %v", err)
	}
	if len(components) != 1 {
		t.Fatalf("expected 1 parsed component, got %d", len(components))
	}
	if components[0].SoftwareName != "OpenSSL" {
		t.Fatalf("expected software name OpenSSL, got %q", components[0].SoftwareName)
	}
	if components[0].SoftwareVersion != "1.1.1" {
		t.Fatalf("expected software version 1.1.1, got %q", components[0].SoftwareVersion)
	}
}

func TestFindComponentsSheetSupportsEnglishName(t *testing.T) {
	t.Parallel()

	name := findComponentsSheet([]string{"Vulnerabilities", "Components"})
	if name != "Components" {
		t.Fatalf("expected Components sheet, got %q", name)
	}
}
