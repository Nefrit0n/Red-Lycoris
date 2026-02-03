import type { Meta, StoryObj } from "@storybook/react";
import { Stack, Typography } from "@mui/material";
import WidgetCard from "./WidgetCard";
import { MetricDisplay } from "../../design-system";

const meta: Meta<typeof WidgetCard> = {
  title: "Dashboard v2/WidgetCard",
  component: WidgetCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof WidgetCard>;

export const Loading: Story = {
  render: () => <WidgetCard title="Risk trend" loading />, 
};

export const Error: Story = {
  render: () => <WidgetCard title="Pipeline gates" error="Unable to load data" />, 
};

export const Empty: Story = {
  render: () => <WidgetCard title="Policy health" emptyMessage="No data available" />, 
};

export const Populated: Story = {
  render: () => (
    <WidgetCard title="Executive snapshot" subtitle="Last 30 days">
      <Stack spacing={2}>
        <MetricDisplay title="Risk score" value={72} size="medium" color="lotus" />
        <Typography variant="body2" color="text.secondary">
          Executive summary of posture improvements and critical risk reduction.
        </Typography>
      </Stack>
    </WidgetCard>
  ),
};
