package lotus.policies.break_build_v1

default decision = "pass"
default violations = []

critical_fix_available[finding] {
	finding := input.findings[_]
	lower(finding.severity) == "critical"
	finding.fixed_version
	finding.fixed_version != ""
}

decision = "fail" {
	count(critical_fix_available) > 0
}

violations := [
	{
		"code": "BUILD.FAIL.CRITICAL.FIX",
		"message": sprintf("Critical finding %s has a fixed version available (%s)", [finding.id, finding.fixed_version]),
		"severity": "critical",
		"action": "build.fail",
		"refs": [finding.id, finding.fixed_version],
	}
	|
	finding := critical_fix_available[_]
]
