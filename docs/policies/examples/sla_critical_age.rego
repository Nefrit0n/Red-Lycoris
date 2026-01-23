package lotus.policies.sla_v1

default decision = "pass"
default violations = []

max_age_days := 30

critical_breach[finding] {
	finding := input.findings[_]
	is_critical(finding)
	is_open(finding)
	age_days(finding.first_seen_at) > max_age_days
}

decision = "fail" {
	count(critical_breach) > 0
}

violations := [
	{
		"code": "SLA.CRITICAL.AGE",
		"message": sprintf("Critical finding %s open for more than %d days", [finding.id, max_age_days]),
		"severity": "critical",
		"action": "notify.sla_breach",
		"refs": [finding.id],
	}
	|
	finding := critical_breach[_]
]

is_critical(finding) {
	lower(finding.severity) == "critical"
}

is_open(finding) {
	status := lower(finding.status)
	status == "open" or status == "new"
}

age_days(ts) = days {
	parsed := time.parse_rfc3339_ns(ts)
	now := time.now_ns()
	diff_ns := now - parsed
	days := diff_ns / (24 * 60 * 60 * 1000000000)
}
