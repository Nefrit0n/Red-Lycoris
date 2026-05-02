package domain

import "testing"

func TestCalculateFingerprintIncludesLineRange(t *testing.T) {
	ruleID := "G124"
	base := Finding{
		Kind:      KindSAST,
		FilePath:  "internal/api/auth.go",
		RuleID:    &ruleID,
		CWEIDs:    []int{614},
		LineStart: 116,
		LineEnd:   116,
	}

	otherLine := base
	otherLine.LineStart = 145
	otherLine.LineEnd = 145

	fp1 := CalculateFingerprint(&base)
	fp2 := CalculateFingerprint(&otherLine)
	if fp1 == fp2 {
		t.Fatalf("fingerprints must differ for same file/rule on different lines: %s", fp1)
	}
}
