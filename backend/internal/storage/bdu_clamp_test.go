package storage

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestClampSoftwareNameForLegacyIndex(t *testing.T) {
	short := "openssl"
	if got := clampSoftwareNameForLegacyIndex(short); got != short {
		t.Fatalf("short value changed: got %q, want %q", got, short)
	}

	longASCII := strings.Repeat("a", legacySoftwareNameIndexSafeBytes+128)
	gotASCII := clampSoftwareNameForLegacyIndex(longASCII)
	if len(gotASCII) != legacySoftwareNameIndexSafeBytes {
		t.Fatalf("ascii clamp len=%d, want %d", len(gotASCII), legacySoftwareNameIndexSafeBytes)
	}

	longUTF8 := strings.Repeat("Ж", legacySoftwareNameIndexSafeBytes)
	gotUTF8 := clampSoftwareNameForLegacyIndex(longUTF8)
	if len(gotUTF8) > legacySoftwareNameIndexSafeBytes {
		t.Fatalf("utf8 clamp len=%d, want <=%d", len(gotUTF8), legacySoftwareNameIndexSafeBytes)
	}
	if !utf8.ValidString(gotUTF8) {
		t.Fatal("utf8 clamp result is invalid utf-8")
	}
}
