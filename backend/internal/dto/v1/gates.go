package v1

type GateCheckRequestDTO struct {
	ImportJobID string  `json:"importJobId"`
	ProductID   *string `json:"productId,omitempty"`
	Profile     *string `json:"profile,omitempty"`
	CommitSha   *string `json:"commitSha,omitempty"`
	BuildID     *string `json:"buildId,omitempty"`
}

type GateCheckPolicyDTO struct {
	PolicyID     *string `json:"policyId,omitempty"`
	PolicyRuleID *string `json:"policyRuleId,omitempty"`
	Version      *string `json:"version,omitempty"`
	Sha256       *string `json:"sha256,omitempty"`
}

type GateBlockingFindingDTO struct {
	FindingID     string `json:"findingId"`
	Title         string `json:"title"`
	Severity      string `json:"severity"`
	Category      string `json:"category"`
	ViolationCode string `json:"violationCode"`
}

type GateCheckViolationDTO struct {
	Code     string   `json:"code"`
	Message  string   `json:"message"`
	Severity string   `json:"severity"`
	Refs     []string `json:"refs,omitempty"`
}

type GateCheckResponseDTO struct {
	Pass             bool                     `json:"pass"`
	Decision         string                   `json:"decision"`
	BlockingFindings []GateBlockingFindingDTO `json:"blockingFindings"`
	Violations       []GateCheckViolationDTO  `json:"violations"`
	Policy           *GateCheckPolicyDTO      `json:"policy,omitempty"`
	EvaluatedAt      string                   `json:"evaluatedAt"`
}
