export type PolicyStatus = "enabled" | "disabled";
export type PolicyKind = "gate" | "sla" | "auto_triage";
export type PolicyDecision = "pass" | "fail" | "warn";

export interface PolicyListItemDTO {
  id: string;
  tenantId?: string | null;
  name: string;
  kind: PolicyKind;
  status: PolicyStatus;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion?: string | null;
  assignmentsCount: number;
}

export interface PolicyRuleDTO {
  id: string;
  policyId: string;
  version: string;
  format: string;
  content: string;
  sha256: string;
  entrypoint?: string | null;
  createdAt: string;
}

export interface PolicyAssignmentDTO {
  id: string;
  policyId: string;
  policyRuleId?: string | null;
  scope: string;
  scopeId?: string | null;
  priority: number;
  createdAt: string;
}

export interface PolicyDetailDTO extends PolicyListItemDTO {
  activeRule?: PolicyRuleDTO | null;
  versions: PolicyRuleDTO[];
  assignments: PolicyAssignmentDTO[];
}

export interface PolicyResultDTO {
  id: string;
  policyId: string;
  policyRuleId?: string | null;
  subjectType: string;
  subjectId: string;
  decision: PolicyDecision;
  violations?: unknown;
  inputHash: string;
  evaluatedAt: string;
  policyVersion?: string | null;
}

export interface PolicyResultDetailDTO extends PolicyResultDTO {
  policyName?: string | null;
  policyKind?: string | null;
  ruleFormat?: string | null;
  ruleEntrypoint?: string | null;
  actions?: Array<Record<string, unknown>>;
}
