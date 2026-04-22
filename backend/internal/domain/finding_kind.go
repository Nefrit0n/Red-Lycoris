package domain

import (
	"encoding/json"
	"fmt"
	"strings"
)

type FindingKind int

const (
	KindSCA FindingKind = iota
	KindSAST
	KindDAST
	KindIaC
	KindSecrets
	KindOther
)

func (k FindingKind) String() string {
	switch k {
	case KindSCA:
		return "sca"
	case KindSAST:
		return "sast"
	case KindDAST:
		return "dast"
	case KindIaC:
		return "iac"
	case KindSecrets:
		return "secrets"
	default:
		return "other"
	}
}

func ParseFindingKind(s string) (FindingKind, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "sca":
		return KindSCA, true
	case "sast":
		return KindSAST, true
	case "dast":
		return KindDAST, true
	case "iac":
		return KindIaC, true
	case "secrets":
		return KindSecrets, true
	case "other":
		return KindOther, true
	default:
		return KindOther, false
	}
}

// MarshalJSON renders the kind as its short string form so the API contract
// stays stable regardless of the underlying int representation.
func (k FindingKind) MarshalJSON() ([]byte, error) {
	return json.Marshal(k.String())
}

// UnmarshalJSON accepts either the string form ("sca","sast",...) or the
// legacy int form so existing callers keep working.
func (k *FindingKind) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		parsed, ok := ParseFindingKind(s)
		if !ok {
			return fmt.Errorf("unknown finding kind %q", s)
		}
		*k = parsed
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*k = FindingKind(n)
	return nil
}
