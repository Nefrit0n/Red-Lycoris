package domain

import "strings"

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
