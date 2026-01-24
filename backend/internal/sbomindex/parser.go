package sbomindex

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

type ComponentInput struct {
	BomRef    string
	Purl      string
	Name      string
	Version   string
	Ecosystem string
	Supplier  string
	Licenses  []string
	Props     map[string]any
}

type EdgeInput struct {
	From string
	To   string
}

type ParseResult struct {
	Components []ComponentInput
	Edges      []EdgeInput
	RootRef    string
}

func ParseSBOM(format string, payload []byte) (ParseResult, error) {
	switch format {
	case "cyclonedx":
		if json.Valid(payload) {
			return parseCycloneDXJSON(payload)
		}
		return parseCycloneDXXML(payload)
	case "spdx-json":
		return parseSPDXJSON(payload)
	case "spdx":
		return ParseResult{}, fmt.Errorf("spdx tag-value format is not supported")
	default:
		return ParseResult{}, fmt.Errorf("unsupported sbom format")
	}
}

type cyclonedxJSON struct {
	Metadata     cyclonedxJSONMetadata     `json:"metadata"`
	Components   []cyclonedxJSONComponent  `json:"components"`
	Dependencies []cyclonedxJSONDependency `json:"dependencies"`
}

type cyclonedxJSONMetadata struct {
	Component *cyclonedxJSONComponent `json:"component"`
}

type cyclonedxJSONComponent struct {
	BomRef            string                      `json:"bom-ref"`
	Name              string                      `json:"name"`
	Version           string                      `json:"version"`
	Purl              string                      `json:"purl"`
	Scope             string                      `json:"scope"`
	Supplier          *cyclonedxJSONSupplier      `json:"supplier"`
	Licenses          []cyclonedxJSONLicenseEntry `json:"licenses"`
	Hashes            []cyclonedxJSONHash         `json:"hashes"`
	ExternalRefs      []cyclonedxJSONExternalRef  `json:"externalReferences"`
	Properties        []cyclonedxJSONProperty     `json:"properties"`
	ComponentType     string                      `json:"type"`
	Group             string                      `json:"group"`
	Publisher         string                      `json:"publisher"`
	PackageURL        string                      `json:"packageURL"`
	SupplierComponent string                      `json:"supplierComponent"`
}

type cyclonedxJSONSupplier struct {
	Name string `json:"name"`
}

type cyclonedxJSONLicenseEntry struct {
	License    *cyclonedxJSONLicense `json:"license"`
	Expression string                `json:"expression"`
}

type cyclonedxJSONLicense struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

type cyclonedxJSONHash struct {
	Alg     string `json:"alg"`
	Content string `json:"content"`
}

type cyclonedxJSONExternalRef struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type cyclonedxJSONProperty struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type cyclonedxJSONDependency struct {
	Ref       string   `json:"ref"`
	DependsOn []string `json:"dependsOn"`
}

func parseCycloneDXJSON(payload []byte) (ParseResult, error) {
	var doc cyclonedxJSON
	if err := json.Unmarshal(payload, &doc); err != nil {
		return ParseResult{}, fmt.Errorf("invalid cyclonedx json: %w", err)
	}

	components := make([]ComponentInput, 0, len(doc.Components)+1)
	if doc.Metadata.Component != nil {
		components = append(components, normalizeCycloneDXComponent(*doc.Metadata.Component))
	}
	for _, comp := range doc.Components {
		components = append(components, normalizeCycloneDXComponent(comp))
	}

	edges := make([]EdgeInput, 0)
	for _, dep := range doc.Dependencies {
		for _, to := range dep.DependsOn {
			edges = append(edges, EdgeInput{From: dep.Ref, To: to})
		}
	}

	rootRef := ""
	if doc.Metadata.Component != nil {
		rootRef = doc.Metadata.Component.BomRef
	}

	return ParseResult{Components: components, Edges: edges, RootRef: rootRef}, nil
}

type cyclonedxXML struct {
	XMLName      xml.Name                `xml:"bom"`
	Metadata     cyclonedxXMLMetadata    `xml:"metadata"`
	Components   []cyclonedxXMLComponent `xml:"components>component"`
	Dependencies []cyclonedxXMLDep       `xml:"dependencies>dependency"`
}

type cyclonedxXMLMetadata struct {
	Component *cyclonedxXMLComponent `xml:"component"`
}

type cyclonedxXMLComponent struct {
	BomRef       string                 `xml:"bom-ref,attr"`
	Name         string                 `xml:"name"`
	Version      string                 `xml:"version"`
	Purl         string                 `xml:"purl"`
	Scope        string                 `xml:"scope"`
	Supplier     cyclonedxXMLSupplier   `xml:"supplier"`
	Licenses     []cyclonedxXMLLicense  `xml:"licenses>license"`
	Hashes       []cyclonedxXMLHash     `xml:"hashes>hash"`
	ExternalRefs []cyclonedxXMLExternal `xml:"externalReferences>reference"`
	Properties   []cyclonedxXMLProperty `xml:"properties>property"`
	ComponentTyp string                 `xml:"type,attr"`
}

type cyclonedxXMLSupplier struct {
	Name string `xml:"name"`
}

type cyclonedxXMLLicense struct {
	ID         string `xml:"id"`
	Name       string `xml:"name"`
	Expression string `xml:"expression"`
}

type cyclonedxXMLHash struct {
	Alg     string `xml:"alg,attr"`
	Content string `xml:",chardata"`
}

type cyclonedxXMLExternal struct {
	Type string `xml:"type"`
	URL  string `xml:"url"`
}

type cyclonedxXMLProperty struct {
	Name  string `xml:"name,attr"`
	Value string `xml:"value,attr"`
}

type cyclonedxXMLDep struct {
	Ref         string            `xml:"ref,attr"`
	DependsOn   []cyclonedxXMLRef `xml:"dependency"`
	Description string            `xml:"description"`
}

type cyclonedxXMLRef struct {
	Ref string `xml:"ref,attr"`
}

func parseCycloneDXXML(payload []byte) (ParseResult, error) {
	decoder := xml.NewDecoder(bytes.NewReader(payload))
	decoder.Strict = false

	var doc cyclonedxXML
	if err := decoder.Decode(&doc); err != nil {
		return ParseResult{}, fmt.Errorf("invalid cyclonedx xml: %w", err)
	}

	components := make([]ComponentInput, 0, len(doc.Components)+1)
	if doc.Metadata.Component != nil {
		components = append(components, normalizeCycloneDXXMLComponent(*doc.Metadata.Component))
	}
	for _, comp := range doc.Components {
		components = append(components, normalizeCycloneDXXMLComponent(comp))
	}

	edges := make([]EdgeInput, 0)
	for _, dep := range doc.Dependencies {
		for _, ref := range dep.DependsOn {
			edges = append(edges, EdgeInput{From: dep.Ref, To: ref.Ref})
		}
	}

	rootRef := ""
	if doc.Metadata.Component != nil {
		rootRef = doc.Metadata.Component.BomRef
	}

	return ParseResult{Components: components, Edges: edges, RootRef: rootRef}, nil
}

func normalizeCycloneDXComponent(comp cyclonedxJSONComponent) ComponentInput {
	licenses := normalizeCycloneDXLicenses(comp.Licenses)

	props := map[string]any{}
	if comp.Scope != "" {
		props["scope"] = comp.Scope
	}
	if len(comp.Hashes) > 0 {
		hashes := map[string]string{}
		for _, hash := range comp.Hashes {
			if hash.Alg != "" && hash.Content != "" {
				hashes[strings.ToLower(hash.Alg)] = hash.Content
			}
		}
		if len(hashes) > 0 {
			props["hashes"] = hashes
		}
	}
	if len(comp.ExternalRefs) > 0 {
		externals := make([]map[string]string, 0, len(comp.ExternalRefs))
		for _, ref := range comp.ExternalRefs {
			if ref.URL == "" {
				continue
			}
			externals = append(externals, map[string]string{
				"type": ref.Type,
				"url":  ref.URL,
			})
		}
		if len(externals) > 0 {
			props["externalRefs"] = externals
		}
	}
	if len(comp.Properties) > 0 {
		propsMap := map[string]string{}
		for _, prop := range comp.Properties {
			if prop.Name != "" {
				propsMap[prop.Name] = prop.Value
			}
		}
		if len(propsMap) > 0 {
			props["properties"] = propsMap
		}
	}
	if len(props) == 0 {
		props = nil
	}

	supplier := ""
	if comp.Supplier != nil {
		supplier = normalizeSupplier(comp.Supplier.Name)
	}

	purl := strings.TrimSpace(comp.Purl)
	if purl == "" {
		purl = strings.TrimSpace(comp.PackageURL)
	}

	ecosystem, name, version := normalizeComponentIdentity(purl, comp.Name, comp.Version)

	return ComponentInput{
		BomRef:    comp.BomRef,
		Purl:      purl,
		Name:      name,
		Version:   version,
		Ecosystem: ecosystem,
		Supplier:  supplier,
		Licenses:  licenses,
		Props:     props,
	}
}

func normalizeCycloneDXXMLComponent(comp cyclonedxXMLComponent) ComponentInput {
	licenses := normalizeXMLLicenses(comp.Licenses)

	props := map[string]any{}
	if comp.Scope != "" {
		props["scope"] = comp.Scope
	}
	if len(comp.Hashes) > 0 {
		hashes := map[string]string{}
		for _, hash := range comp.Hashes {
			if hash.Alg != "" && hash.Content != "" {
				hashes[strings.ToLower(hash.Alg)] = strings.TrimSpace(hash.Content)
			}
		}
		if len(hashes) > 0 {
			props["hashes"] = hashes
		}
	}
	if len(comp.ExternalRefs) > 0 {
		externals := make([]map[string]string, 0, len(comp.ExternalRefs))
		for _, ref := range comp.ExternalRefs {
			if ref.URL == "" {
				continue
			}
			externals = append(externals, map[string]string{
				"type": ref.Type,
				"url":  ref.URL,
			})
		}
		if len(externals) > 0 {
			props["externalRefs"] = externals
		}
	}
	if len(comp.Properties) > 0 {
		propsMap := map[string]string{}
		for _, prop := range comp.Properties {
			if prop.Name != "" {
				propsMap[prop.Name] = prop.Value
			}
		}
		if len(propsMap) > 0 {
			props["properties"] = propsMap
		}
	}
	if len(props) == 0 {
		props = nil
	}

	supplier := normalizeSupplier(comp.Supplier.Name)
	purl := strings.TrimSpace(comp.Purl)
	ecosystem, name, version := normalizeComponentIdentity(purl, comp.Name, comp.Version)

	return ComponentInput{
		BomRef:    comp.BomRef,
		Purl:      purl,
		Name:      name,
		Version:   version,
		Ecosystem: ecosystem,
		Supplier:  supplier,
		Licenses:  licenses,
		Props:     props,
	}
}

func normalizeCycloneDXLicenses(entries []cyclonedxJSONLicenseEntry) []string {
	values := make([]string, 0)
	for _, entry := range entries {
		if entry.Expression != "" {
			values = append(values, entry.Expression)
			continue
		}
		if entry.License != nil {
			if entry.License.Expression != "" {
				values = append(values, entry.License.Expression)
				continue
			}
			if entry.License.ID != "" {
				values = append(values, entry.License.ID)
				continue
			}
			if entry.License.Name != "" {
				values = append(values, entry.License.Name)
			}
		}
	}
	return normalizeLicenseList(values)
}

func normalizeXMLLicenses(entries []cyclonedxXMLLicense) []string {
	values := make([]string, 0)
	for _, entry := range entries {
		if entry.Expression != "" {
			values = append(values, entry.Expression)
			continue
		}
		if entry.ID != "" {
			values = append(values, entry.ID)
			continue
		}
		if entry.Name != "" {
			values = append(values, entry.Name)
		}
	}
	return normalizeLicenseList(values)
}

type spdxDocument struct {
	Packages      []spdxPackage      `json:"packages"`
	Relationships []spdxRelationship `json:"relationships"`
}

type spdxPackage struct {
	SPDXID           string            `json:"SPDXID"`
	Name             string            `json:"name"`
	VersionInfo      string            `json:"versionInfo"`
	Supplier         string            `json:"supplier"`
	LicenseDeclared  string            `json:"licenseDeclared"`
	LicenseConcluded string            `json:"licenseConcluded"`
	ExternalRefs     []spdxExternalRef `json:"externalRefs"`
}

type spdxExternalRef struct {
	ReferenceType     string `json:"referenceType"`
	ReferenceLocator  string `json:"referenceLocator"`
	ReferenceCategory string `json:"referenceCategory"`
}

type spdxRelationship struct {
	ElementID        string `json:"spdxElementId"`
	RelationshipType string `json:"relationshipType"`
	RelatedElementID string `json:"relatedSpdxElement"`
}

func parseSPDXJSON(payload []byte) (ParseResult, error) {
	var doc spdxDocument
	if err := json.Unmarshal(payload, &doc); err != nil {
		return ParseResult{}, fmt.Errorf("invalid spdx json: %w", err)
	}

	components := make([]ComponentInput, 0, len(doc.Packages))
	for _, pkg := range doc.Packages {
		purl := extractPurl(pkg.ExternalRefs)
		ecosystem, name, version := normalizeComponentIdentity(purl, pkg.Name, pkg.VersionInfo)
		licenses := normalizeLicenseList([]string{normalizeSpdxLicense(pkg.LicenseConcluded), normalizeSpdxLicense(pkg.LicenseDeclared)})
		components = append(components, ComponentInput{
			BomRef:    pkg.SPDXID,
			Purl:      purl,
			Name:      name,
			Version:   version,
			Ecosystem: ecosystem,
			Supplier:  normalizeSupplier(pkg.Supplier),
			Licenses:  licenses,
		})
	}

	edges := make([]EdgeInput, 0)
	for _, rel := range doc.Relationships {
		from := strings.TrimSpace(rel.ElementID)
		to := strings.TrimSpace(rel.RelatedElementID)
		if from == "" || to == "" {
			continue
		}
		typeNorm := strings.ToUpper(strings.TrimSpace(rel.RelationshipType))
		switch typeNorm {
		case "DEPENDS_ON", "DEPENDENCY_MANIFEST_OF":
			edges = append(edges, EdgeInput{From: from, To: to})
		case "DEPENDENCY_OF":
			edges = append(edges, EdgeInput{From: to, To: from})
		}
	}

	return ParseResult{Components: components, Edges: edges}, nil
}

func normalizeComponentIdentity(purl string, name string, version string) (string, string, string) {
	purl = strings.TrimSpace(purl)
	name = strings.TrimSpace(name)
	version = strings.TrimSpace(version)

	if purl != "" {
		eco, purlName, purlVersion := parsePurl(purl)
		if eco != "" {
			if name == "" {
				name = purlName
			}
			if version == "" {
				version = purlVersion
			}
			return eco, name, version
		}
	}

	return "", name, version
}

func parsePurl(purl string) (string, string, string) {
	purl = strings.TrimSpace(purl)
	if !strings.HasPrefix(purl, "pkg:") {
		return "", "", ""
	}
	trimmed := strings.TrimPrefix(purl, "pkg:")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) < 2 {
		return "", "", ""
	}
	ecosystem := parts[0]
	namePart := parts[1]

	namePart = strings.SplitN(namePart, "?", 2)[0]
	namePart = strings.SplitN(namePart, "#", 2)[0]

	var name string
	var version string
	if at := strings.Index(namePart, "@"); at >= 0 {
		name = namePart[:at]
		version = namePart[at+1:]
	} else {
		name = namePart
	}

	decodedName, err := url.PathUnescape(name)
	if err == nil {
		name = decodedName
	}

	return ecosystem, name, version
}

func normalizeLicenseList(values []string) []string {
	seen := map[string]struct{}{}
	list := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || strings.EqualFold(value, "NOASSERTION") || strings.EqualFold(value, "NONE") {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		list = append(list, value)
	}
	sort.Strings(list)
	return list
}

func normalizeSupplier(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "Organization:")
	value = strings.TrimPrefix(value, "Person:")
	return strings.TrimSpace(value)
}

func extractPurl(refs []spdxExternalRef) string {
	for _, ref := range refs {
		if strings.EqualFold(ref.ReferenceType, "purl") {
			return strings.TrimSpace(ref.ReferenceLocator)
		}
	}
	return ""
}

func normalizeSpdxLicense(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.EqualFold(value, "NOASSERTION") || strings.EqualFold(value, "NONE") {
		return ""
	}
	return value
}
