export type HealthResponse = {
  service?: string;
  status?: string;
};

export type Product = {
  id?: string;
  name?: string;
};

export type IngestPayload = {
  tenant_id: string;
  product: string;
  tool: string;
  report: string;
};

export type IngestResponse = {
  status?: string;
  subject?: string;
  trace_id?: string;
  received_at?: string;
};
