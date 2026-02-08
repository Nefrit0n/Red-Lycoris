import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Add, Edit, Refresh, Restore, Save, Tune } from "@mui/icons-material";
import { glass, radius, textStyles } from "../../design-system/tokens";

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  filters?: ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onOpenTemplates: () => void;
  onOpenAddWidget: () => void;
  lastUpdated?: Date | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

const formatLastUpdated = (date: Date | null | undefined): string => {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "только что";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const DashboardShell = ({
  title,
  subtitle,
  timeRange,
  onTimeRangeChange,
  filters,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onReset,
  onOpenTemplates,
  onOpenAddWidget,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: DashboardShellProps) => {
  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        px: { xs: 3, md: 6, xl: 8 },
        py: 3,
        ...glass.header,
        borderRadius: radius.card,
        backdropFilter: glass.header.backdropFilter,
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
        <Box flex={1}>
          <Typography sx={textStyles.heading.h4}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Select
            size="small"
            value={timeRange}
            onChange={(event) => onTimeRangeChange(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="7d">Последние 7 дней</MenuItem>
            <MenuItem value="30d">Последние 30 дней</MenuItem>
            <MenuItem value="90d">Последние 90 дней</MenuItem>
            <MenuItem value="365d">Последние 12 месяцев</MenuItem>
          </Select>

          {onRefresh && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Обновить данные">
                <IconButton
                  size="small"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  sx={{ color: "text.secondary" }}
                >
                  {isRefreshing ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <Refresh fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {formatLastUpdated(lastUpdated)}
                </Typography>
              )}
            </Stack>
          )}

          {filters}

          <Button
            variant="outlined"
            startIcon={<Tune />}
            onClick={onOpenTemplates}
          >
            Шаблоны
          </Button>

          {isEditing ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" startIcon={<Add />} onClick={onOpenAddWidget}>
                Добавить виджет
              </Button>
              <Button variant="contained" startIcon={<Save />} onClick={onSave}>
                Сохранить
              </Button>
              <Button variant="text" onClick={onCancel}>
                Отмена
              </Button>
              <Button variant="text" color="inherit" startIcon={<Restore />} onClick={onReset}>
                Сбросить
              </Button>
            </Stack>
          ) : (
            <Button variant="contained" startIcon={<Edit />} onClick={onEdit}>
              Редактировать
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default DashboardShell;
