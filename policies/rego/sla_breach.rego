package lotus.policies.sla_breach

default decision := {
	"outcome": "pass",
	"actions": [],
	"violations": [],
}

severity_sla_days := {
	"CRITICAL": 7,
	"HIGH": 14,
	"MEDIUM": 30,
	"LOW": 90,
}

is_breach if {
	input.finding.firstSeenAt != ""
	severity_sla_days[input.finding.severity] == days
	first_seen := time.parse_rfc3339_ns(input.finding.firstSeenAt)
	due_at := time.add_date(first_seen, 0, 0, days)
	now := time.now_ns()
	now >= due_at
}

decision := {
	"outcome": "warn",
	"actions": [
		{
			"type": "sla_breach",
			"reason": "Finding exceeded SLA.",
		},
	],
	"violations": [
		{
			"code": "SLA_BREACH",
			"message": "Finding exceeded SLA for its severity.",
			"severity": "high",
		},
	],
} if {
	is_breach
}
