package domain

import "testing"

func TestResolveKind_ContentSignals(t *testing.T) {
	ruleID := "G101"
	purl := "pkg:npm/lodash@4.17.4"
	url := "https://example.test/login"
	secretKind := "github-token"
	iacResource := "aws_s3_bucket.public"

	cases := []struct {
		name string
		f    Finding
		want FindingKind
	}{
		{name: "purl sca", f: Finding{Purl: &purl}, want: KindSCA},
		{name: "component version sca", f: Finding{Component: "log4j-core", ComponentVersion: "2.14.1"}, want: KindSCA},
		{name: "url dast", f: Finding{URL: &url}, want: KindDAST},
		{name: "secret kind secrets", f: Finding{SecretKind: &secretKind}, want: KindSecrets},
		{name: "iac resource iac", f: Finding{IacResource: &iacResource}, want: KindIaC},
		{name: "file rule sast", f: Finding{FilePath: "main.go", RuleID: &ruleID}, want: KindSAST},
		{name: "empty other", f: Finding{}, want: KindOther},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ResolveKind(&tc.f, nil); got != tc.want {
				t.Fatalf("ResolveKind() = %s, want %s", got, tc.want)
			}
		})
	}
}

func TestResolveKind_ContentBeatsScannerNameAndOverride(t *testing.T) {
	iacResource := "aws_s3_bucket.public"
	f := Finding{
		SourceType:  "trivy",
		IacResource: &iacResource,
	}
	if got := ResolveKind(&f, nil); got != KindIaC {
		t.Fatalf("ResolveKind() = %s, want %s", got, KindIaC)
	}

	url := "https://example.test"
	f = Finding{
		SourceType: "weirdtool",
		URL:        &url,
	}
	overrides := map[string]FindingKind{"weirdtool": KindSCA}
	if got := ResolveKind(&f, overrides); got != KindDAST {
		t.Fatalf("ResolveKind() = %s, want %s", got, KindDAST)
	}
}

func TestResolveKind_OverrideWhenContentSilent(t *testing.T) {
	f := Finding{SourceType: "weirdtool"}
	overrides := map[string]FindingKind{"weirdtool": KindSCA}
	if got := ResolveKind(&f, overrides); got != KindSCA {
		t.Fatalf("ResolveKind() = %s, want %s", got, KindSCA)
	}
}

func TestResolveKind_MultiCategoryScannerIsNotWeakHint(t *testing.T) {
	f := Finding{SourceType: "semgrep"}
	if got := ResolveKind(&f, nil); got != KindOther {
		t.Fatalf("ResolveKind() = %s, want %s", got, KindOther)
	}
}
