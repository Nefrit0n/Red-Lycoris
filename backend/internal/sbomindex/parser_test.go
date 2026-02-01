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

func TestParseSPDXJSONWithDescribes(t *testing.T) {
	// Test that DESCRIBES relationship correctly identifies the root package
	payload := []byte(`{
		"spdxVersion": "SPDX-2.3",
		"SPDXID": "SPDXRef-DOCUMENT",
		"name": "test-sbom",
		"packages": [
			{
				"SPDXID": "SPDXRef-RootPackage",
				"name": "my-app",
				"versionInfo": "1.0.0"
			},
			{
				"SPDXID": "SPDXRef-DirectDep",
				"name": "lodash",
				"versionInfo": "4.17.21",
				"externalRefs": [{"referenceType": "purl", "referenceLocator": "pkg:npm/lodash@4.17.21"}]
			},
			{
				"SPDXID": "SPDXRef-TransitiveDep",
				"name": "is-buffer",
				"versionInfo": "1.1.6",
				"externalRefs": [{"referenceType": "purl", "referenceLocator": "pkg:npm/is-buffer@1.1.6"}]
			}
		],
		"relationships": [
			{"spdxElementId": "SPDXRef-DOCUMENT", "relationshipType": "DESCRIBES", "relatedSpdxElement": "SPDXRef-RootPackage"},
			{"spdxElementId": "SPDXRef-RootPackage", "relationshipType": "DEPENDS_ON", "relatedSpdxElement": "SPDXRef-DirectDep"},
			{"spdxElementId": "SPDXRef-DirectDep", "relationshipType": "DEPENDS_ON", "relatedSpdxElement": "SPDXRef-TransitiveDep"}
		]
	}`)

	result, err := parseSPDXJSON(payload)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Should have 3 components
	if len(result.Components) != 3 {
		t.Fatalf("expected 3 components, got %d", len(result.Components))
	}

	// Should have 2 dependency edges (not counting DESCRIBES)
	if len(result.Edges) != 2 {
		t.Fatalf("expected 2 edges, got %d", len(result.Edges))
	}

	// RootRef should be set to the DESCRIBED package
	if result.RootRef != "SPDXRef-RootPackage" {
		t.Fatalf("expected RootRef to be SPDXRef-RootPackage, got %s", result.RootRef)
	}
}

func TestParseSPDXJSONDependencyOf(t *testing.T) {
	// Test that DEPENDENCY_OF relationship is correctly reversed
	payload := []byte(`{
		"spdxVersion": "SPDX-2.3",
		"packages": [
			{"SPDXID": "SPDXRef-A", "name": "package-a", "versionInfo": "1.0.0"},
			{"SPDXID": "SPDXRef-B", "name": "package-b", "versionInfo": "1.0.0"}
		],
		"relationships": [
			{"spdxElementId": "SPDXRef-B", "relationshipType": "DEPENDENCY_OF", "relatedSpdxElement": "SPDXRef-A"}
		]
	}`)

	result, err := parseSPDXJSON(payload)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// DEPENDENCY_OF means B is a dependency OF A, so edge should be A -> B
	if len(result.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(result.Edges))
	}
	if result.Edges[0].From != "SPDXRef-A" || result.Edges[0].To != "SPDXRef-B" {
		t.Fatalf("expected edge from A to B, got from %s to %s", result.Edges[0].From, result.Edges[0].To)
	}
}
