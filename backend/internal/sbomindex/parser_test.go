package sbomindex

import "testing"

func TestParseCycloneDXJSON(t *testing.T) {
	payload := []byte(`{
		"bomFormat": "CycloneDX",
		"metadata": {"component": {"bom-ref": "root", "name": "app", "version": "1.0.0"}},
		"components": [
			{"bom-ref": "pkg-1", "name": "lodash", "version": "4.17.21", "purl": "pkg:npm/lodash@4.17.21", "licenses": [{"license": {"id": "MIT"}}]}
		],
		"dependencies": [
			{"ref": "root", "dependsOn": ["pkg-1"]}
		]
	}`)

	result, err := parseCycloneDXJSON(payload)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if len(result.Components) != 2 {
		t.Fatalf("expected 2 components, got %d", len(result.Components))
	}
	if len(result.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(result.Edges))
	}
	if result.RootRef != "root" {
		t.Fatalf("expected root ref root, got %s", result.RootRef)
	}
}

func TestParseSPDXJSON(t *testing.T) {
	payload := []byte(`{
		"spdxVersion": "SPDX-2.3",
		"packages": [
			{
				"SPDXID": "SPDXRef-Package",
				"name": "requests",
				"versionInfo": "2.31.0",
				"supplier": "Organization: Python",
				"licenseDeclared": "Apache-2.0",
				"externalRefs": [
					{"referenceType": "purl", "referenceLocator": "pkg:pypi/requests@2.31.0"}
				]
			},
			{
				"SPDXID": "SPDXRef-Dep",
				"name": "urllib3",
				"versionInfo": "1.26.18"
			}
		],
		"relationships": [
			{"spdxElementId": "SPDXRef-Package", "relationshipType": "DEPENDS_ON", "relatedSpdxElement": "SPDXRef-Dep"}
		]
	}`)

	result, err := parseSPDXJSON(payload)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if len(result.Components) != 2 {
		t.Fatalf("expected 2 components, got %d", len(result.Components))
	}
	if len(result.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(result.Edges))
	}
	if result.Components[0].Ecosystem == "" {
		t.Fatalf("expected ecosystem derived from purl")
	}
}
