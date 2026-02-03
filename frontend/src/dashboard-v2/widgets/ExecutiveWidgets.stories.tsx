import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import WidgetCard from "../components/WidgetCard";
import { widgetRegistry } from "./registry";

const meta: Meta = {
  title: "Dashboard v2/Executive Widgets",
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

export const KpiOpenFindings: Story = {
  render: () => renderWidget("kpi-open-findings"),
};

export const KpiCriticalHigh: Story = {
  render: () => renderWidget("kpi-critical-high"),
};

export const KpiProductsRisk: Story = {
  render: () => renderWidget("kpi-products-risk"),
};

export const KpiScanFreshness: Story = {
  render: () => renderWidget("kpi-scan-freshness"),
};

export const ExecRiskTrend: Story = {
  render: () => (
    <Box sx={{ width: 620, height: 320 }}>
      {renderWidget("exec-risk-trend", 620, 320)}
    </Box>
  ),
};

export const ExecTopRiskyProducts: Story = {
  render: () => renderWidget("exec-top-risky-products"),
};

export const ExecSlaBreaches: Story = {
  render: () => renderWidget("exec-sla-breaches"),
};

export const ExecCriticalActivity: Story = {
  render: () => renderWidget("exec-critical-activity"),
};

export const ExecCoverageSnapshot: Story = {
  render: () => renderWidget("exec-coverage-snapshot"),
};
