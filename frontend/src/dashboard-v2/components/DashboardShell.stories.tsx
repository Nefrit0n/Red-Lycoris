import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import DashboardShell from "./DashboardShell";

const meta: Meta<typeof DashboardShell> = {
  title: "Dashboard v2/DashboardShell",
  component: DashboardShell,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof DashboardShell>;

export const Normal: Story = {
  render: () => (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <DashboardShell
        title="Security Command Center"
        subtitle="Template: Executive / CISO"
        timeRange="30d"
        onTimeRangeChange={() => undefined}
        isEditing={false}
        onEdit={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onReset={() => undefined}
        onOpenTemplates={() => undefined}
        onOpenAddWidget={() => undefined}
      />
    </Box>
  ),
};

export const EditMode: Story = {
  render: () => (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <DashboardShell
        title="Security Command Center"
        subtitle="Template: AppSec Lead"
        timeRange="90d"
        onTimeRangeChange={() => undefined}
        isEditing
        onEdit={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onReset={() => undefined}
        onOpenTemplates={() => undefined}
        onOpenAddWidget={() => undefined}
      />
    </Box>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <DashboardShell
        title="Security Command Center"
        subtitle="Template: Developer"
        timeRange="7d"
        onTimeRangeChange={() => undefined}
        isEditing
        onEdit={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onReset={() => undefined}
        onOpenTemplates={() => undefined}
        onOpenAddWidget={() => undefined}
      />
    </Box>
  ),
};
