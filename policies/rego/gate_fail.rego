package lotus.policies.gate_fail

default decision := {
	"outcome": "pass",
	"actions": [],
	"violations": [],
}

decision := {
	"outcome": "fail",
	"actions": [
		{
			"type": "gate_fail",
			"reason": "critical fix available",
		},
	],
	"violations": [
		{
			"code": "GATE_CRITICAL_FIX",
			"message": "Critical finding has a fixed version available.",
			"severity": "critical",
			"refs": ["playbook://vuln-management/critical-fix"],
		},
	],
} if {
	input.finding.severity == "CRITICAL"
	input.finding.fixedVersion != ""
}
