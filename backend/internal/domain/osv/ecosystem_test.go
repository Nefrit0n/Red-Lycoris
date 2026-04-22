package osv

import "testing"

func TestDetectEcosystem(t *testing.T) {
	tests := []struct {
		name       string
		sourceType string
		kind       string
		component  string
		want       string
	}{
		{
			name:       "trivy go module fallback",
			sourceType: "trivy",
			kind:       "sca",
			component:  "github.com/docker/docker",
			want:       "Go",
		},
		{
			name:       "npm by source type",
			sourceType: "npm-audit",
			kind:       "sca",
			component:  "lodash",
			want:       "npm",
		},
		{
			name:      "npm scoped package by component",
			kind:      "sca",
			component: "@angular/core",
			want:      "npm",
		},
		{
			name:      "maven by component",
			kind:      "sca",
			component: "org.apache.commons:commons-lang3",
			want:      "Maven",
		},
		{
			name:      "pypi fallback",
			kind:      "sca",
			component: "django",
			want:      "PyPI",
		},
		{
			name:      "path to regexp fallback",
			kind:      "sca",
			component: "path-to-regexp",
			want:      "PyPI",
		},
		{
			name: "empty component unknown",
			kind: "sca",
			want: "",
		},
		{
			name:       "sast may still map by fallback",
			sourceType: "semgrep",
			kind:       "sast",
			component:  "django",
			want:       "PyPI",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectEcosystem(tt.sourceType, tt.kind, tt.component)
			if got != tt.want {
				t.Fatalf("DetectEcosystem(%q, %q, %q) = %q, want %q", tt.sourceType, tt.kind, tt.component, got, tt.want)
			}
		})
	}
}
