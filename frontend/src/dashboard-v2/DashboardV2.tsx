import { Box, Button, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import {
  ArrowDownward,
  ArrowUpward,
  Close,
  GridView,
  PushPin,
} from "@mui/icons-material";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddWidgetDialog from "./components/AddWidgetDialog";
import DashboardShell from "./components/DashboardShell";
import TemplatePicker from "./components/TemplatePicker";
import WidgetCard from "./components/WidgetCard";
import { glass, primitives, space, textStyles } from "../design-system/tokens";
import { widgetRegistry } from "./widgets/registry";
import { useDashboardLayout } from "./state/useDashboardLayout";

const columns = 12;
const rowHeight = 96;

const DashboardV2 = () => {
  const {
    templates,
    selectedTemplate,
    layout,
    isEditing,
    startEditing,
    cancelEditing,
    saveLayout,
    applyTemplate,
    resetLayout,
    updateLayout,
  } = useDashboardLayout();
  const [timeRange, setTimeRange] = useState("30d");
  const [productFilter, setProductFilter] = useState("All products");
  const [environmentFilter, setEnvironmentFilter] = useState("All environments");
  const [developerRepo, setDeveloperRepo] = useState("Payments API");
  const [developerBranch, setDeveloperBranch] = useState("main");
  const [developerEnv, setDeveloperEnv] = useState("Production");
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);

  const widgetMap = useMemo(() => {
    return new Map(widgetRegistry.map((widget) => [widget.id, widget]));
  }, []);

  const placedWidgets = layout
    .map((placement) => ({
      placement,
      definition: widgetMap.get(placement.widgetId),
    }))
    .filter((item) => item.definition);

  const handleMove = (widgetId: string, direction: "up" | "down") => {
    const current = layout.find((item) => item.widgetId === widgetId);
    if (!current) return;
    const delta = direction === "up" ? -1 : 1;
    const nextLayout = layout.map((item) =>
      item.widgetId === widgetId
        ? { ...item, y: Math.max(0, item.y + delta) }
        : item
    );
    updateLayout(nextLayout);
  };

  const handleRemove = (widgetId: string) => {
    updateLayout(layout.filter((item) => item.widgetId !== widgetId));
  };

  const handlePin = (widgetId: string) => {
    const target = layout.find((item) => item.widgetId === widgetId);
    if (!target) return;
    const nextLayout = layout.map((item) => {
      if (item.widgetId === widgetId) {
        return { ...item, y: 0 };
      }
      if (item.y < target.h) {
        return { ...item, y: item.y + target.h };
      }
      return item;
    });
    updateLayout(nextLayout);
  };

  const handleAddWidget = (widgetId: string) => {
    const widget = widgetMap.get(widgetId);
    if (!widget) return;
    const nextY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    updateLayout([
      ...layout,
      {
        widgetId: widget.id,
        x: 0,
        y: nextY + 1,
        w: widget.defaultSize.w,
        h: widget.defaultSize.h,
      },
    ]);
    setIsAddWidgetOpen(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top, ${primitives.night[700]} 0%, ${primitives.night[800]} 45%, ${primitives.night[950]} 100%)`,
        color: "text.primary",
      }}
    >
      <DashboardShell
        title="Security Command Center"
        subtitle={`Template: ${selectedTemplate.role}`}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        filters={
          selectedTemplate.id === "appsec-devsecops" ? (
            <>
              <Select
                size="small"
                value={productFilter}
                onChange={(event) => setProductFilter(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="All products">All products</MenuItem>
                <MenuItem value="Payments API">Payments API</MenuItem>
                <MenuItem value="Identity Gateway">Identity Gateway</MenuItem>
                <MenuItem value="Core Platform">Core Platform</MenuItem>
                <MenuItem value="Mobile Wallet">Mobile Wallet</MenuItem>
              </Select>
              <Select
                size="small"
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="All environments">All environments</MenuItem>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Staging">Staging</MenuItem>
                <MenuItem value="Development">Development</MenuItem>
              </Select>
            </>
          ) : selectedTemplate.id === "developer" ? (
            <>
              <Typography variant="caption" color="text.secondary">
                My scope
              </Typography>
              <Select
                size="small"
                value={developerRepo}
                onChange={(event) => setDeveloperRepo(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="Payments API">Payments API</MenuItem>
                <MenuItem value="Identity Gateway">Identity Gateway</MenuItem>
                <MenuItem value="Core Platform">Core Platform</MenuItem>
                <MenuItem value="Mobile Wallet">Mobile Wallet</MenuItem>
              </Select>
              <Select
                size="small"
                value={developerBranch}
                onChange={(event) => setDeveloperBranch(event.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="main">main</MenuItem>
                <MenuItem value="release/1.2">release/1.2</MenuItem>
                <MenuItem value="feature/auth">feature/auth</MenuItem>
              </Select>
              <Select
                size="small"
                value={developerEnv}
                onChange={(event) => setDeveloperEnv(event.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Staging">Staging</MenuItem>
                <MenuItem value="Development">Development</MenuItem>
              </Select>
              <Button
                variant="contained"
                component={Link}
                to="/findings?assignee=me"
              >
                Open findings
              </Button>
            </>
          ) : null
        }
        isEditing={isEditing}
        onEdit={startEditing}
        onSave={saveLayout}
        onCancel={cancelEditing}
        onReset={resetLayout}
        onOpenTemplates={() => setIsTemplateOpen(true)}
        onOpenAddWidget={() => setIsAddWidgetOpen(true)}
      />

      <Box sx={{ px: { xs: 3, md: 6, xl: 8 }, py: 4 }}>
        <Stack spacing={3}>
          {isEditing && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px dashed rgba(255, 255, 255, 0.12)`,
                display: "flex",
                alignItems: "center",
                gap: 2,
                ...glass.light,
              }}
            >
              <GridView fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Edit mode enabled. Use the arrows to reorder or remove widgets.
              </Typography>
            </Box>
          )}

          {layout.length === 0 ? (
            <Box
              sx={{
                p: 6,
                borderRadius: 3,
                textAlign: "center",
                border: `1px dashed rgba(255, 255, 255, 0.12)`,
                ...glass.subtle,
              }}
            >
              <Typography sx={textStyles.heading.h5}>No widgets yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Pick a template or add widgets to build your workspace.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridAutoRows: `${rowHeight}px`,
                gap: space[6],
              }}
            >
              {placedWidgets.map(({ placement, definition }) => {
                if (!definition) return null;
                const dataState = definition.getData();
                return (
                  <Box
                    key={definition.id}
                    sx={{
                      gridColumn: `${placement.x + 1} / span ${placement.w}`,
                      gridRow: `${placement.y + 1} / span ${placement.h}`,
                      minWidth: 0,
                    }}
                  >
                    <WidgetCard
                      title={definition.title}
                      subtitle={definition.description}
                      loading={dataState.loading}
                      error={dataState.error}
                      emptyMessage="No data available"
                      isEditing={isEditing}
                      actions={
                        <Stack direction="row" spacing={1} alignItems="center">
                          {definition.linkTo && (
                            <Button
                              component={Link}
                              to={definition.linkTo}
                              size="small"
                              variant="text"
                            >
                              View in Findings
                            </Button>
                          )}
                          {isEditing && (
                            <>
                              {definition.pinnable && (
                                <IconButton
                                  size="small"
                                  aria-label="Pin widget to top"
                                  onClick={() => handlePin(definition.id)}
                                >
                                  <PushPin fontSize="inherit" />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                aria-label="Move widget up"
                                onClick={() => handleMove(definition.id, "up")}
                              >
                                <ArrowUpward fontSize="inherit" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Move widget down"
                                onClick={() => handleMove(definition.id, "down")}
                              >
                                <ArrowDownward fontSize="inherit" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Remove widget"
                                onClick={() => handleRemove(definition.id)}
                              >
                                <Close fontSize="inherit" />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      }
                    >
                      {definition.render(dataState.data)}
                    </WidgetCard>
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
      </Box>

      <TemplatePicker
        open={isTemplateOpen}
        templates={templates}
        selectedTemplateId={selectedTemplate.id}
        onClose={() => setIsTemplateOpen(false)}
        onApply={(templateId) => {
          applyTemplate(templateId);
          setIsTemplateOpen(false);
        }}
      />

      <AddWidgetDialog
        open={isAddWidgetOpen}
        widgets={widgetRegistry}
        onClose={() => setIsAddWidgetOpen(false)}
        onAdd={handleAddWidget}
      />
    </Box>
  );
};

export default DashboardV2;
