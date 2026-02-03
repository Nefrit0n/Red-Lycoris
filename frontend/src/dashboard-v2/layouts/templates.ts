import type { DashboardTemplate } from "../types";

export const TEMPLATE_EXECUTIVE: DashboardTemplate = {
  id: "executive",
  role: "Executive / CISO",
  description: "Executive pulse: risk, products at risk, SLA health, and critical activity.",
  layout: [
    { widgetId: "kpi-open-findings", x: 0, y: 0, w: 3, h: 2 },
    { widgetId: "kpi-critical-high", x: 3, y: 0, w: 3, h: 2 },
    { widgetId: "kpi-products-risk", x: 6, y: 0, w: 3, h: 2 },
    { widgetId: "kpi-scan-freshness", x: 9, y: 0, w: 3, h: 2 },
    { widgetId: "exec-risk-trend", x: 0, y: 2, w: 7, h: 4 },
    { widgetId: "exec-top-risky-products", x: 7, y: 2, w: 5, h: 4 },
    { widgetId: "exec-sla-breaches", x: 0, y: 6, w: 6, h: 3 },
    { widgetId: "exec-critical-activity", x: 6, y: 6, w: 6, h: 3 },
    { widgetId: "exec-coverage-snapshot", x: 0, y: 9, w: 12, h: 3 },
  ],
};

export const TEMPLATE_DEVELOPER: DashboardTemplate = {
  id: "developer",
  role: "Developer",
  description: "Personal workbench with queue, guidance, and hotspots.",
  layout: [
    { widgetId: "kpi-assigned", x: 0, y: 0, w: 4, h: 2 },
    { widgetId: "kpi-needs-attention", x: 4, y: 0, w: 4, h: 2 },
    { widgetId: "kpi-new-since", x: 8, y: 0, w: 4, h: 2 },
    { widgetId: "dev-quick-filters", x: 0, y: 2, w: 12, h: 2 },
    { widgetId: "dev-my-queue", x: 0, y: 4, w: 7, h: 7 },
    { widgetId: "dev-fix-guidance", x: 7, y: 4, w: 5, h: 3 },
    { widgetId: "dev-hotspots", x: 7, y: 7, w: 5, h: 2 },
    { widgetId: "dev-recently-introduced", x: 7, y: 9, w: 5, h: 2 },
  ],
};

export const dashboardTemplates: DashboardTemplate[] = [
  TEMPLATE_EXECUTIVE,
  {
    id: "appsec-devsecops",
    role: "AppSec Lead / DevSecOps",
    description: "Command center for findings flow, coverage, policy, and pipeline health.",
    layout: [
      { widgetId: "kpi-new-findings", x: 0, y: 0, w: 3, h: 2 },
      { widgetId: "kpi-mttr", x: 3, y: 0, w: 3, h: 2 },
      { widgetId: "kpi-coverage", x: 6, y: 0, w: 3, h: 2 },
      { widgetId: "kpi-policy-pass", x: 9, y: 0, w: 3, h: 2 },
      { widgetId: "findings-flow", x: 0, y: 2, w: 6, h: 3 },
      { widgetId: "policy-gates-summary", x: 6, y: 2, w: 6, h: 3 },
      { widgetId: "severity-status-distribution", x: 0, y: 5, w: 4, h: 4 },
      { widgetId: "top-noisy-rules", x: 4, y: 5, w: 4, h: 4 },
      { widgetId: "pipeline-health", x: 8, y: 5, w: 4, h: 4 },
      { widgetId: "coverage-freshness", x: 0, y: 9, w: 6, h: 3 },
      { widgetId: "severity-status-matrix", x: 6, y: 9, w: 6, h: 3 },
      { widgetId: "workload-flow", x: 0, y: 12, w: 12, h: 3 },
    ],
  },
  {
    id: "appsec",
    role: "AppSec Lead",
    description: "Backlog prioritization, program coverage, and top risks.",
    layout: [
      { widgetId: "kpi-open-findings", x: 0, y: 0, w: 4, h: 2 },
      { widgetId: "top-risks", x: 4, y: 0, w: 4, h: 3 },
      { widgetId: "recent-activity", x: 8, y: 0, w: 4, h: 3 },
      { widgetId: "risk-trend", x: 0, y: 2, w: 8, h: 4 },
      { widgetId: "policy-health", x: 0, y: 6, w: 6, h: 3 },
      { widgetId: "coverage-domains", x: 6, y: 6, w: 6, h: 3 },
    ],
  },
  {
    id: "devsecops",
    role: "DevSecOps",
    description: "Pipeline gates, coverage, and policy compliance signals.",
    layout: [
      { widgetId: "pipeline-gates", x: 0, y: 0, w: 6, h: 3 },
      { widgetId: "coverage-domains", x: 6, y: 0, w: 6, h: 3 },
      { widgetId: "policy-health", x: 0, y: 3, w: 5, h: 3 },
      { widgetId: "risk-trend", x: 5, y: 3, w: 7, h: 4 },
      { widgetId: "recent-activity", x: 0, y: 6, w: 5, h: 3 },
      { widgetId: "top-risks", x: 5, y: 7, w: 7, h: 3 },
    ],
  },
  TEMPLATE_DEVELOPER,
];

export const defaultTemplateId = "executive";
