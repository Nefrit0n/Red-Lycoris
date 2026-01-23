package lotus.policies.auto_assign

default decision := {
	"outcome": "pass",
	"actions": [],
	"violations": [],
}

decision := {
	"outcome": "pass",
	"actions": [
		{
			"type": "auto_assign",
			"reason": "Route SCA findings to the SCA on-call group.",
		},
	],
	"violations": [],
} if {
	input.finding.category == "SCA"
}
