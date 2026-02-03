import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import TemplatePicker from "./TemplatePicker";
import { dashboardTemplates } from "../layouts/templates";

const meta: Meta<typeof TemplatePicker> = {
  title: "Dashboard v2/TemplatePicker",
  component: TemplatePicker,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof TemplatePicker>;

export const Default: Story = {
  render: () => (
    <Box sx={{ width: 800 }}>
      <TemplatePicker
        open
        templates={dashboardTemplates}
        selectedTemplateId="executive"
        onClose={() => undefined}
        onApply={() => undefined}
      />
    </Box>
  ),
};
