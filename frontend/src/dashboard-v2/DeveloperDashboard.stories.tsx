import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import DashboardShell from "./components/DashboardShell";
import WidgetCard from "./components/WidgetCard";
import { glass, primitives, space, textStyles } from "../design-system/tokens";
import { TEMPLATE_DEVELOPER } from "./layouts/templates";
import { widgetRegistry } from "./widgets/registry";

const meta: Meta = {
  title: "Dashboard v2/DeveloperDashboard",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

const DeveloperDashboardCanvas = ({
  mode,
}: {
  mode: "loaded" | "empty" | "error";
}) => {
  const widgetMap = new Map(widgetRegistry.map((widget) => [widget.id, widget]));

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top, ${primitives.night[700]} 0%, ${primitives.night[800]} 45%, ${primitives.night[950]} 100%)`,
      }}
    >
      <DashboardShell
        title="Security Command Center"
        subtitle="Template: Developer"
        timeRange="7d"
        onTimeRangeChange={() => undefined}
        filters={
          <>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>My scope</Box>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>Payments API</Box>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>main</Box>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>Production</Box>
          </>
        }
        isEditing={false}
        onEdit={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onReset={() => undefined}
        onOpenTemplates={() => undefined}
        onOpenAddWidget={() => undefined}
      />

      <Box sx={{ px: { xs: 3, md: 6, xl: 8 }, py: 4 }}>
        {mode === "empty" ? (
          <Box
            sx={{
              p: 6,
              borderRadius: 3,
              textAlign: "center",
              border: `1px dashed rgba(255, 255, 255, 0.12)`,
              ...glass.subtle,
            }}
          >
            <Box sx={textStyles.heading.h5}>No widgets yet</Box>
            <Box sx={{ color: "text.secondary", mt: 1 }}>Pick a template to start.</Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gridAutoRows: "96px",
              gap: space[6],
            }}
          >
            {TEMPLATE_DEVELOPER.layout.map((placement) => {
              const widget = widgetMap.get(placement.widgetId);
              if (!widget) return null;
              const dataState = widget.getData();
              const error = mode === "error" ? "Unable to load" : dataState.error;
              const showContent = mode === "loaded";
              return (
                <Box
                  key={widget.id}
                  sx={{
                    gridColumn: `${placement.x + 1} / span ${placement.w}`,
                    gridRow: `${placement.y + 1} / span ${placement.h}`,
                    minWidth: 0,
                  }}
                >
                  <WidgetCard
                    title={widget.title}
                    subtitle={widget.description}
                    error={error}
                    emptyMessage="No data available"
                  >
                    {showContent ? widget.render(dataState.data) : null}
                  </WidgetCard>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const Loaded: Story = {
  render: () => <DeveloperDashboardCanvas mode="loaded" />,
};

export const Empty: Story = {
  render: () => <DeveloperDashboardCanvas mode="empty" />,
};

export const Error: Story = {
  render: () => <DeveloperDashboardCanvas mode="error" />,
};
