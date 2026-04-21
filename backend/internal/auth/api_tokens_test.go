package auth

import (
	"strings"
	"testing"
)

func TestPATGenerateParseAndHash(t *testing.T) {
	full, prefix, hash, err := GeneratePAT()
	if err != nil {
		t.Fatalf("GeneratePAT: %v", err)
	}
	if full == "" || prefix == "" || hash == "" {
		t.Fatalf("empty outputs: full=%q prefix=%q hash=%q", full, prefix, hash)
	}

	p, secret, err := ParsePAT(full)
	if err != nil {
		t.Fatalf("ParsePAT: %v", err)
	}
	if p != prefix {
		t.Fatalf("prefix mismatch: got %q want %q", p, prefix)
	}
	if got := HashPATSecret(secret); got != hash {
		t.Fatalf("hash mismatch: got %q want %q", got, hash)
	}
}

// TestPATUnderscoreInSecret generates many tokens and ensures ParsePAT handles
// tokens whose base64url-encoded secret contains underscores (≈48% of tokens).
func TestPATUnderscoreInSecret(t *testing.T) {
	found := 0
	const iterations = 500
	for i := 0; i < iterations; i++ {
		full, prefix, hash, err := GeneratePAT()
		if err != nil {
			t.Fatalf("GeneratePAT: %v", err)
		}
		p, secret, err := ParsePAT(full)
		if err != nil {
			t.Fatalf("ParsePAT failed for token %q: %v", full, err)
		}
		if p != prefix {
			t.Fatalf("prefix mismatch: got %q want %q", p, prefix)
		}
		if got := HashPATSecret(secret); got != hash {
			t.Fatalf("hash mismatch for token %q", full)
		}
		if strings.Contains(secret, "_") {
			found++
		}
	}
	if found == 0 {
		t.Log("warning: no underscores found in secrets across", iterations, "iterations (unlikely)")
	}
}

func TestParsePATInvalid(t *testing.T) {
	cases := []string{"", "abc", "Bearer rl_pat_x_y", "rl_pat_bad", "rl_pat_11111111_x"}
	for _, tc := range cases {
		if _, _, err := ParsePAT(tc); err == nil {
			t.Fatalf("expected error for %q", tc)
		}
	}
}
