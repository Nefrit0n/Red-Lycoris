package lotus.policies.sla_breach_test

import data.lotus.policies.sla_breach

test_sla_breach_when_overdue if {
	input := {
		"finding": {
			"severity": "CRITICAL",
			"firstSeenAt": "2020-01-01T00:00:00Z",
		},
	}
	decision := data.lotus.policies.sla_breach.decision with input as input
	decision.outcome == "warn"
	decision.actions[0].type == "sla_breach"
}
