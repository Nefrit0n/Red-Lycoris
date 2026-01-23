package lotus.policies.auto_assign_test

import data.lotus.policies.auto_assign

test_auto_assign_for_sca if {
	input := {
		"finding": {
			"category": "SCA",
		},
	}
	decision := data.lotus.policies.auto_assign.decision with input as input
	decision.outcome == "pass"
	decision.actions[0].type == "auto_assign"
}
