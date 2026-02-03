import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import DashboardShell from "./components/DashboardShell";
import WidgetCard from "./components/WidgetCard";
import { glass, primitives, space, textStyles } from "../design-system/tokens";
import { dashboardTemplates } from "./layouts/templates";
import { widgetRegistry } from "./widgets/registry";

const meta: Meta = {
  title: "Dashboard v2/AppSecDevSecOpsDashboard",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

const template = dashboardTemplates.find((item) => item.id === "appsec-devsecops");

const AppSecDevSecOpsCanvas = ({
  mode,
}: {
  mode: "loaded" | "empty" | "error";
}) => {
  if (!template) return null;
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
        subtitle="Template: AppSec Lead / DevSecOps"
        timeRange="7d"
        onTimeRangeChange={() => undefined}
        filters={
          <>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>All products</Box>
            <Box sx={{ color: "text.secondary", fontSize: 12 }}>All environments</Box>
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
            {template.layout.map((placement) => {
              const widget = widgetMap.get(placement.widgetId);
              if (!widget) return null;
              const dataState = { data: widget.previewData ?? null, loading: false, error: null };
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
  render: () => <AppSecDevSecOpsCanvas mode="loaded" />,
};

export const Empty: Story = {
  render: () => <AppSecDevSecOpsCanvas mode="empty" />,
};

export const Error: Story = {
  render: () => <AppSecDevSecOpsCanvas mode="error" />,
};
