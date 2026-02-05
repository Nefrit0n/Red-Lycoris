import {
  Badge,
  Box,
  Button,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useMemo } from "react";
import { FiltersState } from "../types/filters";
import { countActiveFilters } from "../utils/filters";
import { primitives } from "../design-system/tokens/colors";
import { focusRing } from "../design-system/tokens";
import ViewsDropdown from "./ViewsDropdown";
import { FilterChips } from "./FilterChips";

interface FiltersBarProps {
  filters: FiltersState;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  onApplyPreset: (presetId: string) => void;
  onApplyView: (filters: Partial<FiltersState>) => void;
  onProductIdsChange: (value: string[]) => void;
  onSeveritiesChange: (value: FiltersState["severities"]) => void;
  onStatusesChange: (value: FiltersState["statuses"]) => void;
  onRiskBandsChange: (value: FiltersState["riskBands"]) => void;
  onOccurrencesChange: (value: FiltersState["occurrences"]) => void;
  onScannerTypesChange: (value: string[]) => void;
  onPolicyDecisionsChange: (value: FiltersState["policyDecisions"]) => void;
  onCategoriesChange: (value: FiltersState["categories"]) => void;
  onDatePresetChange: (value: FiltersState["datePreset"]) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowRepeatsChange: (value: boolean) => void;
}

const presetChips = [
  { id: "critical-high", label: "Критичные/высокие" },
  { id: "open-only", label: "Только открытые" },
  { id: "last-24h", label: "Последние 24 часа" },
  { id: "sca", label: "SCA" },
  { id: "sast", label: "SAST" },
  { id: "secrets", label: "Секреты" },
];

const FiltersBar = ({
  filters,
  onSearchChange,
  onOpenFilters,
  onResetFilters,
  onApplyPreset,
  onApplyView,
  onProductIdsChange,
  onSeveritiesChange,
  onStatusesChange,
  onRiskBandsChange,
  onOccurrencesChange,
  onScannerTypesChange,
  onPolicyDecisionsChange,
  onCategoriesChange,
  onDatePresetChange,
  onDateFromChange,
  onDateToChange,
  onShowRepeatsChange,
}: FiltersBarProps) => {
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasActiveFilters = activeCount > 0;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(primitives.night[500], 0.5),
        bgcolor: alpha(primitives.night[750], 0.65),
        backdropFilter: "blur(10px)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems="center">
            <TextField
              value={filters.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск"
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: primitives.night[300] }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: { xs: "100%", md: 280 },
                maxWidth: { xs: "100%", md: 360 },
                "& .MuiOutlinedInput-root": {
                  height: 40,
                  bgcolor: alpha(primitives.night[700], 0.6),
                  borderRadius: 1.5,
                  "& fieldset": { borderColor: alpha(primitives.night[500], 0.7) },
                  "&:hover fieldset": { borderColor: alpha(primitives.night[400], 0.8) },
                  "&.Mui-focused": {
                    boxShadow: focusRing.subtle,
                  },
                },
              }}
            />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {presetChips.map((preset) => (
                <Chip
                  key={preset.id}
                  size="small"
                  label={preset.label}
                  variant="outlined"
                  onClick={() => onApplyPreset(preset.id)}
                  sx={{
                    borderColor: alpha(primitives.night[500], 0.6),
                    bgcolor: alpha(primitives.night[700], 0.45),
                    color: primitives.night[100],
                    "&:hover": {
                      borderColor: primitives.lotus[400],
                      bgcolor: alpha(primitives.lotus[500], 0.12),
                    },
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <ViewsDropdown currentFilters={filters} onApplyView={onApplyView} />

            <Badge
              badgeContent={activeCount}
              color="error"
              invisible={!hasActiveFilters}
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: primitives.lotus[500],
                  color: primitives.white,
                  fontWeight: 600,
                },
              }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={onOpenFilters}
                startIcon={<FilterListIcon />}
                sx={{
                  height: 36,
                  borderColor: hasActiveFilters
                    ? primitives.lotus[500]
                    : alpha(primitives.night[500], 0.6),
                  color: hasActiveFilters ? primitives.lotus[300] : primitives.night[200],
                  bgcolor: alpha(primitives.night[800], 0.4),
                  textTransform: "none",
                  "&:hover": {
                    borderColor: primitives.lotus[500],
                    bgcolor: alpha(primitives.lotus[500], 0.12),
                  },
                }}
              >
                Фильтры
              </Button>
            </Badge>

            {hasActiveFilters ? (
              <Button
                variant="text"
                size="small"
                onClick={onResetFilters}
                startIcon={<RestartAltIcon />}
                sx={{
                  textTransform: "none",
                  color: primitives.night[200],
                  "&:hover": { color: primitives.lotus[300] },
                }}
              >
                Сбросить
              </Button>
            ) : null}
          </Stack>
        </Stack>

        {hasActiveFilters ? (
          <FilterChips
            productIds={filters.productIds}
            search={filters.search}
            severities={filters.severities}
            statuses={filters.statuses}
            riskBands={filters.riskBands}
            occurrences={filters.occurrences}
            scannerTypes={filters.scannerTypes}
            policyDecisions={filters.policyDecisions}
            categories={filters.categories}
            datePreset={filters.datePreset}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            showRepeats={filters.showRepeats}
            onProductIdsChange={onProductIdsChange}
            onSearchChange={onSearchChange}
            onSeveritiesChange={onSeveritiesChange}
            onStatusesChange={onStatusesChange}
            onRiskBandsChange={onRiskBandsChange}
            onOccurrencesChange={onOccurrencesChange}
            onScannerTypesChange={onScannerTypesChange}
            onPolicyDecisionsChange={onPolicyDecisionsChange}
            onCategoriesChange={onCategoriesChange}
            onDatePresetChange={onDatePresetChange}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
            onShowRepeatsChange={onShowRepeatsChange}
            maxVisible={6}
            onExpand={onOpenFilters}
          />
        ) : (
          <Typography variant="caption" sx={{ color: primitives.night[500] }}>
            Активные фильтры не выбраны
          </Typography>
        )}

      </Stack>
    </Box>
  );
};

export default FiltersBar;
