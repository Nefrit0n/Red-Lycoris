import {
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Add, Edit, Restore, Save, Tune } from "@mui/icons-material";
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
}

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
