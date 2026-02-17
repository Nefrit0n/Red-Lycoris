package security

import "testing"

func TestGenerateHashVerify(t *testing.T) {
	tok, err := GenerateIntegrationToken()
	if err != nil {
		t.Fatal(err)
	}
	if tok[:4] != "rlx_" {
		t.Fatalf("unexpected token format: %s", tok)
	}
	h, err := HashToken(tok)
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyToken(tok, h) {
		t.Fatal("verify failed")
	}
	if VerifyToken(tok+"x", h) {
		t.Fatal("verify should fail")
	}
}

func TestValidateScopes(t *testing.T) {
	if err := ValidateScopeList([]string{"ingest:run:init", "admin:tokens:write"}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateScopeList([]string{"bad:scope"}); err == nil {
		t.Fatal("expected error")
	}
}
