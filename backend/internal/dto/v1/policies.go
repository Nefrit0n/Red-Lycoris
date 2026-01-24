package v1

import "encoding/json"

type PolicyDTO struct {
	ID          string  `json:"id"`
	TenantID    *string `json:"tenantId,omitempty"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	Status      string  `json:"status"`
	Description *string `json:"description,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

type PolicyListItemDTO struct {
	PolicyDTO
	LatestVersion    *string `json:"latestVersion,omitempty"`
	AssignmentsCount int     `json:"assignmentsCount"`
}

type PolicyRuleDTO struct {
	ID         string  `json:"id"`
	PolicyID   string  `json:"policyId"`
	Version    string  `json:"version"`
	Format     string  `json:"format"`
	Content    string  `json:"content"`
	Sha256     string  `json:"sha256"`
	Entrypoint *string `json:"entrypoint,omitempty"`
	CreatedAt  string  `json:"createdAt"`
}

type PolicyAssignmentDTO struct {
	ID           string  `json:"id"`
	PolicyID     string  `json:"policyId"`
	PolicyRuleID *string `json:"policyRuleId,omitempty"`
	Scope        string  `json:"scope"`
	ScopeID      *string `json:"scopeId,omitempty"`
	Priority     int     `json:"priority"`
	CreatedAt    string  `json:"createdAt"`
}

type PolicyDetailDTO struct {
	PolicyDTO
	LatestVersion    *string               `json:"latestVersion,omitempty"`
	AssignmentsCount int                   `json:"assignmentsCount"`
	ActiveRule       *PolicyRuleDTO        `json:"activeRule,omitempty"`
	Versions         []PolicyRuleDTO       `json:"versions"`
	Assignments      []PolicyAssignmentDTO `json:"assignments"`
}

type PolicyResultDTO struct {
	ID            string          `json:"id"`
	PolicyID      string          `json:"policyId"`
	PolicyRuleID  *string         `json:"policyRuleId,omitempty"`
	SubjectType   string          `json:"subjectType"`
	SubjectID     string          `json:"subjectId"`
	Decision      string          `json:"decision"`
	Violations    json.RawMessage `json:"violations,omitempty"`
	InputHash     string          `json:"inputHash"`
	EvaluatedAt   string          `json:"evaluatedAt"`
	PolicyVersion *string         `json:"policyVersion,omitempty"`
}

type PolicyResultDetailDTO struct {
	PolicyResultDTO
	PolicyName     *string                  `json:"policyName,omitempty"`
	PolicyKind     *string                  `json:"policyKind,omitempty"`
	RuleFormat     *string                  `json:"ruleFormat,omitempty"`
	RuleEntrypoint *string                  `json:"ruleEntrypoint,omitempty"`
	Actions        []map[string]interface{} `json:"actions,omitempty"`
}
