package cwe

// OWASPCategory — маппинг CWE на OWASP Top 10 2021.
type OWASPCategory struct {
	ID   string // "A01:2021"
	Name string // "Broken Access Control"
}

// Top25Entry — маппинг CWE на CWE Top 25 2024.
type Top25Entry struct {
	Rank int // 1-25
}

// LookupOWASP возвращает OWASP Top 10 2021 категорию для CWE ID.
// Если CWE не в маппинге — возвращает nil.
func LookupOWASP(cweID int) *OWASPCategory {
	if cat, ok := owaspMap[cweID]; ok {
		return &cat
	}
	return nil
}

// LookupTop25 возвращает позицию в CWE Top 25 2024.
func LookupTop25(cweID int) *Top25Entry {
	if entry, ok := top25Map[cweID]; ok {
		return &entry
	}
	return nil
}

// Статические маппинги. Источники:
// OWASP: https://owasp.org/Top10/
// CWE Top 25: https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html

var owaspMap = map[int]OWASPCategory{
	// A01:2021 — Broken Access Control
	22:   {ID: "A01:2021", Name: "Broken Access Control"},
	23:   {ID: "A01:2021", Name: "Broken Access Control"},
	35:   {ID: "A01:2021", Name: "Broken Access Control"},
	59:   {ID: "A01:2021", Name: "Broken Access Control"},
	200:  {ID: "A01:2021", Name: "Broken Access Control"},
	201:  {ID: "A01:2021", Name: "Broken Access Control"},
	219:  {ID: "A01:2021", Name: "Broken Access Control"},
	264:  {ID: "A01:2021", Name: "Broken Access Control"},
	275:  {ID: "A01:2021", Name: "Broken Access Control"},
	276:  {ID: "A01:2021", Name: "Broken Access Control"},
	284:  {ID: "A01:2021", Name: "Broken Access Control"},
	285:  {ID: "A01:2021", Name: "Broken Access Control"},
	352:  {ID: "A01:2021", Name: "Broken Access Control"},
	359:  {ID: "A01:2021", Name: "Broken Access Control"},
	377:  {ID: "A01:2021", Name: "Broken Access Control"},
	402:  {ID: "A01:2021", Name: "Broken Access Control"},
	425:  {ID: "A01:2021", Name: "Broken Access Control"},
	441:  {ID: "A01:2021", Name: "Broken Access Control"},
	497:  {ID: "A01:2021", Name: "Broken Access Control"},
	538:  {ID: "A01:2021", Name: "Broken Access Control"},
	540:  {ID: "A01:2021", Name: "Broken Access Control"},
	548:  {ID: "A01:2021", Name: "Broken Access Control"},
	552:  {ID: "A01:2021", Name: "Broken Access Control"},
	566:  {ID: "A01:2021", Name: "Broken Access Control"},
	601:  {ID: "A01:2021", Name: "Broken Access Control"},
	639:  {ID: "A01:2021", Name: "Broken Access Control"},
	651:  {ID: "A01:2021", Name: "Broken Access Control"},
	668:  {ID: "A01:2021", Name: "Broken Access Control"},
	706:  {ID: "A01:2021", Name: "Broken Access Control"},
	862:  {ID: "A01:2021", Name: "Broken Access Control"},
	863:  {ID: "A01:2021", Name: "Broken Access Control"},
	913:  {ID: "A01:2021", Name: "Broken Access Control"},
	922:  {ID: "A01:2021", Name: "Broken Access Control"},
	1275: {ID: "A01:2021", Name: "Broken Access Control"},

	// A02:2021 — Cryptographic Failures
	261: {ID: "A02:2021", Name: "Cryptographic Failures"},
	296: {ID: "A02:2021", Name: "Cryptographic Failures"},
	310: {ID: "A02:2021", Name: "Cryptographic Failures"},
	319: {ID: "A02:2021", Name: "Cryptographic Failures"},
	321: {ID: "A02:2021", Name: "Cryptographic Failures"},
	322: {ID: "A02:2021", Name: "Cryptographic Failures"},
	323: {ID: "A02:2021", Name: "Cryptographic Failures"},
	324: {ID: "A02:2021", Name: "Cryptographic Failures"},
	325: {ID: "A02:2021", Name: "Cryptographic Failures"},
	326: {ID: "A02:2021", Name: "Cryptographic Failures"},
	327: {ID: "A02:2021", Name: "Cryptographic Failures"},
	328: {ID: "A02:2021", Name: "Cryptographic Failures"},
	329: {ID: "A02:2021", Name: "Cryptographic Failures"},
	330: {ID: "A02:2021", Name: "Cryptographic Failures"},
	331: {ID: "A02:2021", Name: "Cryptographic Failures"},
	335: {ID: "A02:2021", Name: "Cryptographic Failures"},
	336: {ID: "A02:2021", Name: "Cryptographic Failures"},
	337: {ID: "A02:2021", Name: "Cryptographic Failures"},
	338: {ID: "A02:2021", Name: "Cryptographic Failures"},
	340: {ID: "A02:2021", Name: "Cryptographic Failures"},
	347: {ID: "A02:2021", Name: "Cryptographic Failures"},
	523: {ID: "A02:2021", Name: "Cryptographic Failures"},
	720: {ID: "A02:2021", Name: "Cryptographic Failures"},
	757: {ID: "A02:2021", Name: "Cryptographic Failures"},
	759: {ID: "A02:2021", Name: "Cryptographic Failures"},
	760: {ID: "A02:2021", Name: "Cryptographic Failures"},
	780: {ID: "A02:2021", Name: "Cryptographic Failures"},
	818: {ID: "A02:2021", Name: "Cryptographic Failures"},
	916: {ID: "A02:2021", Name: "Cryptographic Failures"},

	// A03:2021 — Injection
	20:   {ID: "A03:2021", Name: "Injection"},
	74:   {ID: "A03:2021", Name: "Injection"},
	75:   {ID: "A03:2021", Name: "Injection"},
	77:   {ID: "A03:2021", Name: "Injection"},
	78:   {ID: "A03:2021", Name: "Injection"},
	79:   {ID: "A03:2021", Name: "Injection"},
	80:   {ID: "A03:2021", Name: "Injection"},
	83:   {ID: "A03:2021", Name: "Injection"},
	87:   {ID: "A03:2021", Name: "Injection"},
	88:   {ID: "A03:2021", Name: "Injection"},
	89:   {ID: "A03:2021", Name: "Injection"},
	90:   {ID: "A03:2021", Name: "Injection"},
	91:   {ID: "A03:2021", Name: "Injection"},
	93:   {ID: "A03:2021", Name: "Injection"},
	94:   {ID: "A03:2021", Name: "Injection"},
	95:   {ID: "A03:2021", Name: "Injection"},
	96:   {ID: "A03:2021", Name: "Injection"},
	97:   {ID: "A03:2021", Name: "Injection"},
	98:   {ID: "A03:2021", Name: "Injection"},
	99:   {ID: "A03:2021", Name: "Injection"},
	100:  {ID: "A03:2021", Name: "Injection"},
	113:  {ID: "A03:2021", Name: "Injection"},
	116:  {ID: "A03:2021", Name: "Injection"},
	138:  {ID: "A03:2021", Name: "Injection"},
	184:  {ID: "A03:2021", Name: "Injection"},
	470:  {ID: "A03:2021", Name: "Injection"},
	471:  {ID: "A03:2021", Name: "Injection"},
	564:  {ID: "A03:2021", Name: "Injection"},
	610:  {ID: "A03:2021", Name: "Injection"},
	643:  {ID: "A03:2021", Name: "Injection"},
	644:  {ID: "A03:2021", Name: "Injection"},
	652:  {ID: "A03:2021", Name: "Injection"},
	917:  {ID: "A03:2021", Name: "Injection"},
	1236: {ID: "A03:2021", Name: "Injection"},

	// A04:2021 — Insecure Design
	73:  {ID: "A04:2021", Name: "Insecure Design"},
	183: {ID: "A04:2021", Name: "Insecure Design"},
	209: {ID: "A04:2021", Name: "Insecure Design"},
	256: {ID: "A04:2021", Name: "Insecure Design"},
	501: {ID: "A04:2021", Name: "Insecure Design"},
	522: {ID: "A04:2021", Name: "Insecure Design"},
	587: {ID: "A04:2021", Name: "Insecure Design"},
	602: {ID: "A04:2021", Name: "Insecure Design"},
	603: {ID: "A04:2021", Name: "Insecure Design"},
	656: {ID: "A04:2021", Name: "Insecure Design"},
	// 757 already mapped to A02, keeping A02 (first mapping wins in map literal)
	799: {ID: "A04:2021", Name: "Insecure Design"},
	840: {ID: "A04:2021", Name: "Insecure Design"},
	841: {ID: "A04:2021", Name: "Insecure Design"},
	927: {ID: "A04:2021", Name: "Insecure Design"},

	// A05:2021 — Security Misconfiguration
	2:    {ID: "A05:2021", Name: "Security Misconfiguration"},
	11:   {ID: "A05:2021", Name: "Security Misconfiguration"},
	13:   {ID: "A05:2021", Name: "Security Misconfiguration"},
	15:   {ID: "A05:2021", Name: "Security Misconfiguration"},
	16:   {ID: "A05:2021", Name: "Security Misconfiguration"},
	260:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	315:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	520:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	526:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	537:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	541:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	547:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	611:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	614:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	756:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	776:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	942:  {ID: "A05:2021", Name: "Security Misconfiguration"},
	1004: {ID: "A05:2021", Name: "Security Misconfiguration"},
	1032: {ID: "A05:2021", Name: "Security Misconfiguration"},
	1174: {ID: "A05:2021", Name: "Security Misconfiguration"},

	// A06:2021 — Vulnerable and Outdated Components
	937:  {ID: "A06:2021", Name: "Vulnerable and Outdated Components"},
	1035: {ID: "A06:2021", Name: "Vulnerable and Outdated Components"},
	1104: {ID: "A06:2021", Name: "Vulnerable and Outdated Components"},

	// A07:2021 — Identification and Authentication Failures
	255:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	259:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	287:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	288:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	290:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	294:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	295:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	297:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	300:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	302:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	304:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	306:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	307:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	346:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	384:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	521:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	613:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	620:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	640:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	798:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	940:  {ID: "A07:2021", Name: "Identification and Authentication Failures"},
	1216: {ID: "A07:2021", Name: "Identification and Authentication Failures"},

	// A08:2021 — Software and Data Integrity Failures
	345: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	353: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	426: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	494: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	502: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	565: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	784: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	829: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	830: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},
	915: {ID: "A08:2021", Name: "Software and Data Integrity Failures"},

	// A09:2021 — Security Logging and Monitoring Failures
	117: {ID: "A09:2021", Name: "Security Logging and Monitoring Failures"},
	223: {ID: "A09:2021", Name: "Security Logging and Monitoring Failures"},
	532: {ID: "A09:2021", Name: "Security Logging and Monitoring Failures"},
	778: {ID: "A09:2021", Name: "Security Logging and Monitoring Failures"},

	// A10:2021 — Server-Side Request Forgery (SSRF)
	918: {ID: "A10:2021", Name: "Server-Side Request Forgery (SSRF)"},
}

var top25Map = map[int]Top25Entry{
	// 2024 CWE Top 25 Most Dangerous Software Weaknesses
	// Source: https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html
	79:  {Rank: 1},  // XSS
	787: {Rank: 2},  // Out-of-bounds Write
	89:  {Rank: 3},  // SQL Injection
	352: {Rank: 4},  // CSRF
	22:  {Rank: 5},  // Path Traversal
	125: {Rank: 6},  // Out-of-bounds Read
	78:  {Rank: 7},  // OS Command Injection
	416: {Rank: 8},  // Use After Free
	862: {Rank: 9},  // Missing Authorization
	434: {Rank: 10}, // Unrestricted Upload
	94:  {Rank: 11}, // Code Injection
	20:  {Rank: 12}, // Improper Input Validation
	77:  {Rank: 13}, // Command Injection
	287: {Rank: 14}, // Improper Authentication
	269: {Rank: 15}, // Improper Privilege Management
	502: {Rank: 16}, // Deserialization
	200: {Rank: 17}, // Exposure of Sensitive Info
	863: {Rank: 18}, // Incorrect Authorization
	918: {Rank: 19}, // SSRF
	119: {Rank: 20}, // Buffer Overflow
	476: {Rank: 21}, // NULL Pointer Deref
	798: {Rank: 22}, // Use of Hard-coded Credentials
	190: {Rank: 23}, // Integer Overflow
	400: {Rank: 24}, // Uncontrolled Resource Consumption
	306: {Rank: 25}, // Missing Authentication for Critical Function
}
