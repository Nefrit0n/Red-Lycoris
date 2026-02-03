import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import AddWidgetDialog from "./AddWidgetDialog";
import { widgetRegistry } from "../widgets/registry";

const meta: Meta<typeof AddWidgetDialog> = {
  title: "Dashboard v2/AddWidgetDialog",
  component: AddWidgetDialog,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof AddWidgetDialog>;

export const Default: Story = {
  render: () => (
    <Box sx={{ width: 1000 }}>
      <AddWidgetDialog
        open
        widgets={widgetRegistry}
        dataMap={{}}
        onClose={() => undefined}
        onAdd={() => undefined}
      />
    </Box>
  ),
};
