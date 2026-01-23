package lotus.policies.gate_fail_test

import data.lotus.policies.gate_fail

test_gate_fail_for_critical_fixed_version if {
	input := {
		"finding": {
			"severity": "CRITICAL",
			"fixedVersion": "1.2.3",
		},
	}
	decision := data.lotus.policies.gate_fail.decision with input as input
	decision.outcome == "fail"
	count(decision.actions) == 1
	count(decision.violations) == 1
}
