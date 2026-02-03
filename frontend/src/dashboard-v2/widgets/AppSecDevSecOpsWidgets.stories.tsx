import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import WidgetCard from "../components/WidgetCard";
import { widgetRegistry } from "./registry";

const meta: Meta = {
  title: "Dashboard v2/AppSecDevSecOps Widgets",
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj;

const renderWidget = (widgetId: string, width = 360, height?: number) => {
  const widget = widgetRegistry.find((item) => item.id === widgetId);
  if (!widget) return null;
  const dataState = { data: widget.previewData ?? null, loading: false, error: null };
  return (
    <Box sx={{ width, height }}>
      <WidgetCard
        title={widget.title}
        subtitle={widget.description}
        loading={dataState.loading}
        error={dataState.error}
        emptyMessage="No data"
      >
        {widget.render(dataState.data)}
      </WidgetCard>
    </Box>
  );
};

export const KpiNewFindings: Story = {
  render: () => renderWidget("kpi-new-findings"),
};

export const KpiMttr: Story = {
  render: () => renderWidget("kpi-mttr"),
};

export const KpiCoverage: Story = {
  render: () => renderWidget("kpi-coverage"),
};

export const KpiPolicyPass: Story = {
  render: () => renderWidget("kpi-policy-pass"),
};

export const FindingsFlow: Story = {
  render: () => renderWidget("findings-flow", 620, 320),
};

export const SeverityStatusDistribution: Story = {
  render: () => renderWidget("severity-status-distribution", 420, 320),
};

export const SeverityStatusMatrix: Story = {
  render: () => renderWidget("severity-status-matrix", 520, 280),
};

export const CoverageFreshness: Story = {
  render: () => renderWidget("coverage-freshness", 520, 280),
};

export const PolicyGatesSummary: Story = {
  render: () => renderWidget("policy-gates-summary", 520, 280),
};

export const TopNoisyRules: Story = {
  render: () => renderWidget("top-noisy-rules", 420, 320),
};

export const PipelineHealth: Story = {
  render: () => renderWidget("pipeline-health", 420, 320),
};

export const WorkloadFlow: Story = {
  render: () => renderWidget("workload-flow", 720, 320),
};

export const DevDeliveryMetrics: Story = {
  render: () => renderWidget("dev-delivery-metrics", 520, 280),
};
