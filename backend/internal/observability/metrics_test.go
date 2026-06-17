package observability

import (
	"strings"
	"testing"
)

func TestImportFindingsTotalHasKindLabel(t *testing.T) {
	obs := New("test", "commit", "date")
	obs.ImportFindingsTotal.Inc(map[string]string{
		"format":  "generic",
		"outcome": "inserted",
		"kind":    "sca",
	})

	got := obs.registry.writePrometheusText()
	want := `redlycoris_import_findings_total{format="generic",outcome="inserted",kind="sca"} 1`
	if !strings.Contains(got, want) {
		t.Fatalf("metric output missing %q:\n%s", want, got)
	}
}
