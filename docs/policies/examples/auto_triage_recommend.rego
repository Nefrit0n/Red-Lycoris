package lotus.policies.auto_triage_v1

default decision = "pass"
default violations = []

low_noise[finding] {
	finding := input.findings[_]
	lower(finding.severity) == "low"
	is_open(finding)
}

decision = "warn" {
	count(low_noise) > 0
}

violations := [
	{
		"code": "TRIAGE.RECOMMEND.ACCEPT_RISK",
		"message": sprintf("Recommend accepting risk for low severity finding %s", [finding.id]),
		"severity": "low",
		"action": "auto_triage.recommend.accept_risk",
		"refs": [finding.id],
	}
	|
	finding := low_noise[_]
]

is_open(finding) {
	status := lower(finding.status)
	status == "open" or status == "new"
}
