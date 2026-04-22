package bdu

import "testing"

func TestParseVul_FullRecord(t *testing.T) {
	v := &xmlVul{
		Identifier:      " BDU:2026-01715 ",
		Name:            " Test vuln ",
		Description:     " Desc ",
		Severity:        " Низкий ",
		VulStatus:       " Подтверждена производителем ",
		ExploitStatus:   " Существует в открытом доступе ",
		FixStatus:       " Уязвимость устранена ",
		VulClass:        " Уязвимость кода ",
		ExploitationWay: " Исчерпание ресурсов ",
		MitigationWay:   " Обновление программного обеспечения ",
		CVSS:            xmlCVSSBlock{Vector: xmlCVSSVector{Score: "2.1", Text: "AV:N/AC:H/Au:S/C:N/I:N/A:P"}},
		CVSS3:           xmlCVSSBlock{Vector: xmlCVSSVector{Score: "3.1", Text: "AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:L"}},
		CVSS4:           xmlCVSSBlock{Vector: xmlCVSSVector{Score: "1.3", Text: "AV:N/AC:H/AT:N/PR:L/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N/E:P"}},
		Identifiers: []xmlIdentifierEntry{
			{Type: "CVE", Text: "CVE-2025-5889"},
		},
		VulnerableSoftware: []xmlSoftItem{
			{Vendor: "ООО «Ред Софт»", Name: "РЕД ОС", Version: "7.3", Types: []string{"Операционная система"}},
			{Vendor: "ООО «Ред Софт»", Name: "РЕД ОС", Version: "8.0", Types: []string{"Операционная система"}},
		},
		Environment:     []xmlEnvItem{{Vendor: "ООО «Ред Софт»", Name: "РЕД ОС 7.3"}},
		CWEs:            []xmlCWEEntry{{Identifier: "CWE-400"}},
		Sources:         []string{"https://example.org/a", "https://example.org/a", " https://example.org/b "},
		Solution:        "Использование рекомендаций производителя",
		PublicationDate: "2026-02-11",
		LastUpdDate:     "2026-04-08",
	}

	rec, err := parseVul(v)
	if err != nil {
		t.Fatalf("parseVul() error = %v", err)
	}

	if rec.BDUID != "BDU:2026-01715" {
		t.Fatalf("BDUID = %q", rec.BDUID)
	}
	if rec.CVSSV2Score == nil || *rec.CVSSV2Score != float32(2.1) {
		t.Fatalf("CVSSV2Score = %#v", rec.CVSSV2Score)
	}
	if rec.CVSSV3Score == nil || *rec.CVSSV3Score != float32(3.1) {
		t.Fatalf("CVSSV3Score = %#v", rec.CVSSV3Score)
	}
	if rec.CVSSV4Score == nil || *rec.CVSSV4Score != float32(1.3) {
		t.Fatalf("CVSSV4Score = %#v", rec.CVSSV4Score)
	}
	if len(rec.CVEIDs) != 1 || rec.CVEIDs[0] != "CVE-2025-5889" {
		t.Fatalf("CVEIDs = %#v", rec.CVEIDs)
	}
	if len(rec.CWEIDs) != 1 || rec.CWEIDs[0] != 400 {
		t.Fatalf("CWEIDs = %#v", rec.CWEIDs)
	}
	if rec.Vendor != "ООО «Ред Софт»" || rec.Product != "РЕД ОС" || rec.AffectedVersions != "7.3, 8.0" {
		t.Fatalf("legacy software fields mismatch: vendor=%q product=%q versions=%q", rec.Vendor, rec.Product, rec.AffectedVersions)
	}
	if len(rec.Software) == 0 {
		t.Fatal("expected software JSON data")
	}
	if len(rec.Environment) == 0 {
		t.Fatal("expected environment JSON data")
	}
	if len(rec.Sources) != 2 {
		t.Fatalf("sources = %#v", rec.Sources)
	}
}
