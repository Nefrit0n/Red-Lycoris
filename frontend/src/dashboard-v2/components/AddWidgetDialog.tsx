import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Check } from "@mui/icons-material";
import { useMemo, useState } from "react";
import WidgetCard from "./WidgetCard";
import type { WidgetCategory, WidgetDefinition } from "../types";
import { bordersDark, radius } from "../../design-system/tokens";

interface AddWidgetDialogProps {
  open: boolean;
  widgets: WidgetDefinition[];
  dataMap: Record<string, { data: unknown | null; loading: boolean; error: string | null }>;
  placedWidgetIds?: string[];
  onClose: () => void;
  onAdd: (widgetId: string) => void;
}

const categoryOptions: Array<"All" | WidgetCategory> = [
  "All",
  "Executive",
  "Risk",
  "Engineering",
  "Operations",
  "AppSec",
  "DevSecOps",
];

const categoryLabels: Record<(typeof categoryOptions)[number], string> = {
  All: "Все",
  Executive: "Экзекьютив",
  Risk: "Риски",
  Engineering: "Инженерия",
  Operations: "Операции",
  AppSec: "AppSec",
  DevSecOps: "DevSecOps",
};

const AddWidgetDialog = ({ open, widgets, dataMap, placedWidgetIds = [], onClose, onAdd }: AddWidgetDialogProps) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const placedSet = useMemo(() => new Set(placedWidgetIds), [placedWidgetIds]);

  const filteredWidgets = useMemo(() => {
    return widgets.filter((widget) => {
      const matchesQuery = widget.title.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "All" || widget.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [widgets, query, category]);

  // Available widgets (not yet placed)
  const availableWidgets = useMemo(() => {
    return filteredWidgets.filter((widget) => !placedSet.has(widget.id));
  }, [filteredWidgets, placedSet]);

  const selectedWidget = widgets.find((widget) => widget.id === selectedId) ?? filteredWidgets[0];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Добавить виджет</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} mt={1}>
          <Stack spacing={2} flex={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск виджетов"
                fullWidth
              />
              <Select
                size="small"
                value={category}
                onChange={(event) => setCategory(event.target.value as (typeof categoryOptions)[number])}
                sx={{ minWidth: 160 }}
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {categoryLabels[option]}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
            <Stack spacing={1.5} sx={{ maxHeight: 360, overflowY: "auto" }}>
              {filteredWidgets.map((widget) => {
                const isPlaced = placedSet.has(widget.id);
                return (
                  <Box
                    key={widget.id}
                    onClick={() => !isPlaced && setSelectedId(widget.id)}
                    sx={{
                      p: 2,
                      borderRadius: radius.card,
                      border: widget.id === selectedWidget?.id ? bordersDark.lotus : bordersDark.default,
                      cursor: isPlaced ? "default" : "pointer",
                      opacity: isPlaced ? 0.5 : 1,
                      transition: "border-color 0.2s ease, opacity 0.2s ease",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2">{widget.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {widget.description}
                        </Typography>
                      </Box>
                      {isPlaced && (
                        <Chip
                          icon={<Check fontSize="small" />}
                          label="Добавлен"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

          <Box flex={1}>
            {selectedWidget ? (
              <WidgetCard
                title={selectedWidget.title}
                subtitle={selectedWidget.description}
                emptyMessage="Предпросмотр недоступен"
              >
                {selectedWidget.render(
                  (dataMap[selectedWidget.id]?.data ??
                    selectedWidget.previewData ??
                    selectedWidget.getData?.().data ??
                    null) as any
                )}
              </WidgetCard>
            ) : (
              <Box
                sx={{
                  p: 3,
                  borderRadius: radius.card,
                  border: bordersDark.default,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Нет виджетов по вашему запросу.
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", ml: 2 }}>
          {availableWidgets.length} из {filteredWidgets.length} доступно
        </Typography>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={() => selectedWidget && onAdd(selectedWidget.id)}
          disabled={!selectedWidget || placedSet.has(selectedWidget.id)}
        >
          Добавить виджет
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddWidgetDialog;
