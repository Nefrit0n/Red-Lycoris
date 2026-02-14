package authz

type Permission string

const (
	PermAdminUsersRead       Permission = "admin.users.read"
	PermAdminUsersInvite     Permission = "admin.users.invite"
	PermAdminUsersUpdateRole Permission = "admin.users.update_role"
	PermAdminUsersDeactivate Permission = "admin.users.deactivate"
	PermAdminTeamsRead       Permission = "admin.teams.read"
	PermAdminTeamsWrite      Permission = "admin.teams.write"
	PermAdminProjectsRead    Permission = "admin.projects.read"
	PermAdminProjectsWrite   Permission = "admin.projects.write"
	PermAdminPoliciesRead    Permission = "admin.policies.read"
	PermAdminPoliciesWrite   Permission = "admin.policies.write"
	PermAdminAuditRead       Permission = "admin.audit.read"
	PermProjectAccessRead    Permission = "project.access.read"
	PermProjectAccessWrite   Permission = "project.access.write"
)
