import { request, requestList } from "./client";
import {
  PolicyListItemDTO,
  PolicyDetailDTO,
  PolicyResultDTO,
  PolicyResultDetailDTO,
} from "../types/policies";

export const fetchPolicies = async (params: {
  limit: number;
  offset: number;
  q?: string;
  status?: string;
  kind?: string;
}): Promise<{ data: PolicyListItemDTO[]; total: number }> => {
  return requestList<PolicyListItemDTO>("/api/v1/admin/policies", {
    query: params,
  });
};

export const fetchPolicyDetail = async (id: string): Promise<PolicyDetailDTO> => {
  return request<PolicyDetailDTO>(`/api/v1/admin/policies/${id}`);
};

export const createPolicy = async (payload: {
  name: string;
  kind: string;
  status?: string;
  description?: string | null;
  rule: {
    version: string;
    format: string;
    entrypoint?: string | null;
    content: string;
  };
}): Promise<PolicyDetailDTO> => {
  return request<PolicyDetailDTO>("/api/v1/admin/policies", {
    method: "POST",
    body: payload,
    json: true,
  });
};

export const updatePolicy = async (
  id: string,
  payload: {
    name?: string;
    status?: string;
    description?: string | null;
  }
): Promise<PolicyDetailDTO> => {
  return request<PolicyDetailDTO>(`/api/v1/admin/policies/${id}`, {
    method: "PATCH",
    body: payload,
    json: true,
  });
};

export const addPolicyVersion = async (
  id: string,
  payload: {
    version: string;
    format: string;
    entrypoint?: string | null;
    content: string;
  }
): Promise<void> => {
  await request<void>(`/api/v1/admin/policies/${id}/versions`, {
    method: "POST",
    body: payload,
    json: true,
  });
};

export const updatePolicyAssignments = async (
  id: string,
  payload: {
    assignments: Array<{
      scope: string;
      scopeId?: string | null;
      priority: number;
      pinVersion?: string | null;
      policyRuleId?: string | null;
    }>;
  }
): Promise<void> => {
  await request<void>(`/api/v1/admin/policies/${id}/assignments`, {
    method: "PUT",
    body: payload,
    json: true,
  });
};

export const deletePolicy = async (id: string): Promise<void> => {
  await request<void>(`/api/v1/admin/policies/${id}`, {
    method: "DELETE",
  });
};

export const fetchPolicyResults = async (params: {
  limit: number;
  offset: number;
  policyId?: string;
  productId?: string;
  importJobId?: string;
  decision?: string;
  from?: string;
  to?: string;
}): Promise<{ data: PolicyResultDTO[]; total: number }> => {
  return requestList<PolicyResultDTO>("/api/v1/policy-results", {
    query: params,
  });
};

export const fetchPolicyResultDetail = async (id: string): Promise<PolicyResultDetailDTO> => {
  return request<PolicyResultDetailDTO>(`/api/v1/policy-results/${id}`);
};


const idem = () => ({ "Idempotency-Key": crypto.randomUUID() });

export type SLAPolicySettings = {
  enabled: boolean;
  critical_days: number;
  high_days: number;
  medium_days: number;
  low_days: number;
  due_soon_days: number;
};

export const getOrgSLAPolicy = () =>
  request<{ org_default: SLAPolicySettings }>("/api/v1/admin/policies/sla");

export const putOrgSLAPolicy = (payload: SLAPolicySettings) =>
  request<{ ok: boolean }>("/api/v1/admin/policies/sla", {
    method: "PUT",
    body: payload,
    headers: idem(),
  });

export const getProductSLAPolicy = (productId: string) =>
  request<{ effective: SLAPolicySettings; override: SLAPolicySettings | null }>(
    `/api/v1/admin/products/${productId}/policies/sla`
  );

export const putProductSLAPolicy = (
  productId: string,
  payload: SLAPolicySettings & { override_enabled: boolean }
) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/policies/sla`, {
    method: "PUT",
    body: payload,
    headers: idem(),
  });

export const deleteProductSLAPolicy = (productId: string) =>
  request<{ ok: boolean }>(`/api/v1/admin/products/${productId}/policies/sla`, {
    method: "DELETE",
    headers: idem(),
  });
