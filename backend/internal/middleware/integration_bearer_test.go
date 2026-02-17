package middleware

import "testing"

func TestHasScopes(t *testing.T) {
	if !hasScopes([]string{"a", "b", "c"}, []string{"a", "c"}) {
		t.Fatal("expected true")
	}
	if hasScopes([]string{"a"}, []string{"a", "b"}) {
		t.Fatal("expected false")
	}
}
