package loadtest

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
)

type sarifReport struct {
	Schema  string     `json:"$schema"`
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

type sarifRun struct {
	Tool    sarifTool     `json:"tool"`
	Results []sarifResult `json:"results"`
}

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name    string      `json:"name"`
	Version string      `json:"version"`
	Rules   []sarifRule `json:"rules"`
}

type sarifRule struct {
	ID               string       `json:"id"`
	Name             string       `json:"name"`
	ShortDescription sarifMessage `json:"shortDescription"`
	FullDescription  sarifMessage `json:"fullDescription"`
	Help             sarifMessage `json:"help"`
	Properties       struct {
		References []string `json:"references"`
	} `json:"properties"`
}

type sarifResult struct {
	RuleID    string          `json:"ruleId"`
	RuleIndex int             `json:"ruleIndex"`
	Level     string          `json:"level"`
	Message   sarifMessage    `json:"message"`
	Locations []sarifLocation `json:"locations"`
}

type sarifMessage struct {
	Text string `json:"text"`
}

type sarifLocation struct {
	PhysicalLocation sarifPhysicalLocation `json:"physicalLocation"`
}

type sarifPhysicalLocation struct {
	ArtifactLocation sarifArtifactLocation `json:"artifactLocation"`
	Region           sarifRegion           `json:"region"`
}

type sarifArtifactLocation struct {
	URI string `json:"uri"`
}

type sarifRegion struct {
	StartLine int `json:"startLine"`
	EndLine   int `json:"endLine"`
}

func GenerateSARIF(output string, size int, seed int64) (string, error) {
	if size <= 0 {
		return "", fmt.Errorf("size must be > 0")
	}
	rnd := rand.New(rand.NewSource(seed))

	report := sarifReport{
		Schema:  "https://json.schemastore.org/sarif-2.1.0.json",
		Version: "2.1.0",
		Runs: []sarifRun{{
			Tool: sarifTool{Driver: sarifDriver{
				Name:    "redlycoris-loadtest",
				Version: "0.1.0b",
				Rules:   make([]sarifRule, size),
			}},
			Results: make([]sarifResult, size),
		}},
	}

	for i := 0; i < size; i++ {
		cve := RealCVEs[rnd.Intn(len(RealCVEs))]
		ruleID := fmt.Sprintf("RL-CVE-%05d", i+1)
		report.Runs[0].Tool.Driver.Rules[i] = sarifRule{
			ID:   ruleID,
			Name: "Known Vulnerability " + cve,
			ShortDescription: sarifMessage{
				Text: "Potential vulnerable component found",
			},
			FullDescription: sarifMessage{Text: "Dependency contains known CVE " + cve},
			Help:            sarifMessage{Text: "Upgrade affected package to patched version"},
		}
		report.Runs[0].Tool.Driver.Rules[i].Properties.References = []string{"https://nvd.nist.gov/vuln/detail/" + cve}

		report.Runs[0].Results[i] = sarifResult{
			RuleID:    ruleID,
			RuleIndex: i,
			Level:     "error",
			Message:   sarifMessage{Text: "Detected vulnerable dependency with " + cve},
			Locations: []sarifLocation{{
				PhysicalLocation: sarifPhysicalLocation{
					ArtifactLocation: sarifArtifactLocation{URI: fmt.Sprintf("src/module_%d/deps.lock", i%40)},
					Region:           sarifRegion{StartLine: 1 + (i % 300), EndLine: 1 + (i % 300)},
				},
			}},
		}
	}

	outPath := output
	stat, err := os.Stat(output)
	if err == nil && stat.IsDir() {
		outPath = filepath.Join(output, fmt.Sprintf("sarif_%d.json", size))
	}
	if err != nil && os.IsNotExist(err) {
		if mkErr := os.MkdirAll(output, 0o755); mkErr != nil {
			return "", mkErr
		}
		outPath = filepath.Join(output, fmt.Sprintf("sarif_%d.json", size))
	}

	f, err := os.Create(outPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(report); err != nil {
		return "", err
	}
	return outPath, nil
}
