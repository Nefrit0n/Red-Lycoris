import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowDownward,
  ArrowUpward,
  Close,
  GridView,
  PushPin,
} from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GridLayout, { Layout } from "react-grid-layout";
import { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import AddWidgetDialog from "./components/AddWidgetDialog";
import DashboardShell from "./components/DashboardShell";
import TemplatePicker from "./components/TemplatePicker";
import WidgetCard from "./components/WidgetCard";
import { glass, primitives, textStyles } from "../design-system/tokens";
import { widgetRegistry } from "./widgets/registry";
import { useDashboardLayout } from "./state/useDashboardLayout";
import { useDashboardData } from "./data/useDashboardData";
import { fetchProductsWithStats } from "../api/products";

const columns = 12;
const rowHeight = 96;
const gridGapPx = 24;
const AutoGridLayout = WidthProvider(GridLayout);

const DashboardV2 = () => {
  const {
    templates,
    selectedTemplate,
    layout,
    isEditing,
    hasUnsavedChanges,
    startEditing,
    cancelEditing,
    saveLayout,
    applyTemplate,
    resetLayout,
    updateLayout,
  } = useDashboardLayout();
  const [timeRange, setTimeRange] = useState("30d");
  const [productFilter, setProductFilter] = useState("Все продукты");
  const [environmentFilter, setEnvironmentFilter] = useState("Все окружения");
  const [developerRepo, setDeveloperRepo] = useState("Payments API");
  const [developerBranch, setDeveloperBranch] = useState("main");
  const [developerEnv, setDeveloperEnv] = useState("Прод");
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const { dataMap, lastUpdated, isRefreshing, refresh } = useDashboardData({ timeRange });

  // Load product options from API
  useEffect(() => {
    const controller = new AbortController();
    fetchProductsWithStats(50, 0, controller.signal)
      .then((response) => {
        const names = response.data.map((p) => p.name).sort();
        setProductOptions(names);
      })
      .catch(() => {
        // Ignore errors, use empty list
      });
    return () => controller.abort();
  }, []);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleResetClick = () => {
    setIsResetConfirmOpen(true);
  };

  const handleResetConfirm = () => {
    resetLayout();
    setIsResetConfirmOpen(false);
  };

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
    // Move target to top and shift all other widgets down by target's height
    const nextLayout = layout.map((item) => {
      if (item.widgetId === widgetId) {
        return { ...item, y: 0 };
      }
      // Shift all other widgets down to make room for pinned widget
      return { ...item, y: item.y + target.h };
    });
    updateLayout(nextLayout);
  };

  const handleAddWidget = (widgetId: string) => {
    const widget = widgetMap.get(widgetId);
    if (!widget) return;
    // Prevent adding duplicate widgets
    if (layout.some((item) => item.widgetId === widgetId)) return;
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
        title="Центр управления безопасностью"
        subtitle={`Шаблон: ${selectedTemplate.role}`}
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
                <MenuItem value="Все продукты">Все продукты</MenuItem>
                {productOptions.map((name) => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="Все окружения">Все окружения</MenuItem>
                <MenuItem value="Прод">Прод</MenuItem>
                <MenuItem value="Стадия">Стадия</MenuItem>
                <MenuItem value="Разработка">Разработка</MenuItem>
              </Select>
            </>
          ) : selectedTemplate.id === "developer" ? (
            <>
              <Typography variant="caption" color="text.secondary">
                Моя область
              </Typography>
              <Select
                size="small"
                value={developerRepo}
                onChange={(event) => setDeveloperRepo(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                {productOptions.length > 0 ? (
                  productOptions.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))
                ) : (
                  <MenuItem value={developerRepo}>{developerRepo}</MenuItem>
                )}
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
                <MenuItem value="Прод">Прод</MenuItem>
                <MenuItem value="Стадия">Стадия</MenuItem>
                <MenuItem value="Разработка">Разработка</MenuItem>
              </Select>
              <Button
                variant="contained"
                component={Link}
                to="/findings?assignee=me"
              >
                Открыть находки
              </Button>
            </>
          ) : null
        }
        isEditing={isEditing}
        onEdit={startEditing}
        onSave={saveLayout}
        onCancel={cancelEditing}
        onReset={handleResetClick}
        onOpenTemplates={() => setIsTemplateOpen(true)}
        onOpenAddWidget={() => setIsAddWidgetOpen(true)}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
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
                Режим редактирования включён. Перетаскивайте виджеты и меняйте размер рамки.
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
              <Typography sx={textStyles.heading.h5}>Виджеты отсутствуют</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Выберите шаблон или добавьте виджеты для настройки рабочего пространства.
              </Typography>
            </Box>
          ) : (
            <AutoGridLayout
              cols={columns}
              rowHeight={rowHeight}
              margin={[gridGapPx, gridGapPx]}
              containerPadding={[0, 0]}
              layout={layout.map((item) => ({ ...item, i: item.widgetId }))}
              isDraggable={isEditing}
              isResizable={isEditing}
              resizeHandles={["se", "e", "s"]}
              draggableHandle=".widget-drag-handle"
              onLayoutChange={(nextLayout: Layout[]) => {
                updateLayout(
                  nextLayout.map((item) => ({
                    widgetId: item.i,
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                  }))
                );
              }}
            >
              {placedWidgets.map(({ placement, definition }) => {
                if (!definition) return null;
                const dataState = dataMap[definition.id] ?? {
                  data: null,
                  loading: false,
                  error: null,
                };
                return (
                  <Box
                    key={definition.id}
                    sx={{
                      minWidth: 0,
                      display: "flex",
                    }}
                    data-grid={{
                      i: placement.widgetId,
                      x: placement.x,
                      y: placement.y,
                      w: placement.w,
                      h: placement.h,
                      minW: definition.minSize.w,
                      minH: definition.minSize.h,
                    }}
                  >
                    <WidgetCard
                      title={definition.title}
                      subtitle={definition.description}
                      loading={dataState.loading}
                      error={dataState.error}
                      emptyMessage="Данные не найдены"
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
                              Посмотреть в находках
                            </Button>
                          )}
                          {isEditing && (
                            <>
                              {definition.pinnable && (
                                <IconButton
                                  size="small"
                                  aria-label="Закрепить виджет сверху"
                                  onClick={() => handlePin(definition.id)}
                                >
                                  <PushPin fontSize="inherit" />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                aria-label="Поднять виджет"
                                onClick={() => handleMove(definition.id, "up")}
                              >
                                <ArrowUpward fontSize="inherit" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Опустить виджет"
                                onClick={() => handleMove(definition.id, "down")}
                              >
                                <ArrowDownward fontSize="inherit" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Удалить виджет"
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
            </AutoGridLayout>
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
        dataMap={dataMap}
        onClose={() => setIsAddWidgetOpen(false)}
        onAdd={handleAddWidget}
      />

      <Dialog
        open={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        aria-labelledby="reset-dialog-title"
      >
        <DialogTitle id="reset-dialog-title">Сбросить дашборд?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Все ваши изменения layout будут потеряны, и дашборд вернётся к шаблону по умолчанию.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsResetConfirmOpen(false)}>Отмена</Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained">
            Сбросить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardV2;
