import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import WidgetCard from "../components/WidgetCard";
import { widgetRegistry } from "./registry";

const meta: Meta = {
  title: "Dashboard v2/Developer Widgets",
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

export const MyQueue: Story = {
  render: () => renderWidget("dev-my-queue", 640, 520),
};

export const FixGuidance: Story = {
  render: () => renderWidget("dev-fix-guidance", 520, 360),
};

export const Hotspots: Story = {
  render: () => renderWidget("dev-hotspots", 420, 240),
};

export const RecentlyIntroduced: Story = {
  render: () => renderWidget("dev-recently-introduced", 420, 240),
};
