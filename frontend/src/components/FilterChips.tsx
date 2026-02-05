import { Box, Chip, Stack, Tooltip, alpha } from "@mui/material";
import {
  FindingCategory,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";
import { DatePreset } from "../types/filters";
import {
  SEVERITY_STYLES,
  STATUS_LABELS,
  OCCURRENCE_LABELS,
  RISK_BAND_LABELS,
} from "../utils/findingConstants";
import { primitives } from "../design-system/tokens/colors";
import { CATEGORY_LABELS, DATE_PRESET_LABELS } from "../features/filters/labels";

const DATE_PRESET_OVERRIDES: Partial<Record<DatePreset, string>> = {
  "24h": "Последние 24 часа",
  "7d": "Последние 7 дней",
  "30d": "Последние 30 дней",
  "90d": "Последние 90 дней",
};

interface FilterChipsProps {
  productIds: string[];
  search: string;
  severities: FindingSeverity[];
  statuses: FindingStatus[];
  riskBands: RiskBand[];
  occurrences: FindingOccurrenceStatus[];
  scannerTypes: string[];
  policyDecisions: PolicyDecision[];
  categories: FindingCategory[];
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
  onProductIdsChange: (value: string[]) => void;
  onSearchChange: (value: string) => void;
  onSeveritiesChange: (value: FindingSeverity[]) => void;
  onStatusesChange: (value: FindingStatus[]) => void;
  onRiskBandsChange: (value: RiskBand[]) => void;
  onOccurrencesChange: (value: FindingOccurrenceStatus[]) => void;
  onScannerTypesChange: (value: string[]) => void;
  onPolicyDecisionsChange: (value: PolicyDecision[]) => void;
  onCategoriesChange: (value: FindingCategory[]) => void;
  onDatePresetChange: (value: DatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowRepeatsChange: (value: boolean) => void;
  maxVisible?: number;
  onExpand?: () => void;
  onResetAll?: () => void;
}

/**
 * FilterChips component - displays active filters as removable chips
 */
export const FilterChips = ({
  productIds,
  search,
  severities,
  statuses,
  riskBands,
  occurrences,
  scannerTypes,
  policyDecisions,
  categories,
  datePreset,
  dateFrom,
  dateTo,
  showRepeats,
  onProductIdsChange,
  onSearchChange,
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
  maxVisible,
  onExpand,
  onResetAll,
}: FilterChipsProps) => {
  const chips: Array<{
    key: string;
    label: string;
    onDelete: () => void;
  }> = [];

  productIds.forEach((productId) => {
    chips.push({
      key: `product-${productId}`,
      label: `Продукт: ${productId}`,
      onDelete: () => onProductIdsChange(productIds.filter((id) => id !== productId)),
    });
  });

  severities.forEach((severity) => {
    chips.push({
      key: `severity-${severity}`,
      label: `Критичность: ${SEVERITY_STYLES[severity].label}`,
      onDelete: () => onSeveritiesChange(severities.filter((value) => value !== severity)),
    });
  });

  statuses.forEach((status) => {
    chips.push({
      key: `status-${status}`,
      label: `Статус: ${STATUS_LABELS[status]}`,
      onDelete: () => onStatusesChange(statuses.filter((value) => value !== status)),
    });
  });

  riskBands.forEach((riskBand) => {
    chips.push({
      key: `riskBand-${riskBand}`,
      label: `Риск: ${RISK_BAND_LABELS[riskBand]}`,
      onDelete: () => onRiskBandsChange(riskBands.filter((value) => value !== riskBand)),
    });
  });

  occurrences.forEach((occurrence) => {
    chips.push({
      key: `occurrence-${occurrence}`,
      label: `Повторяемость: ${OCCURRENCE_LABELS[occurrence]}`,
      onDelete: () =>
        onOccurrencesChange(occurrences.filter((value) => value !== occurrence)),
    });
  });

  scannerTypes.forEach((scanner) => {
    chips.push({
      key: `scanner-${scanner}`,
      label: `Сканер: ${scanner}`,
      onDelete: () => onScannerTypesChange(scannerTypes.filter((value) => value !== scanner)),
    });
  });

  policyDecisions.forEach((decision) => {
    chips.push({
      key: `policy-${decision}`,
      label: `Политика: ${decision.toUpperCase()}`,
      onDelete: () =>
        onPolicyDecisionsChange(policyDecisions.filter((value) => value !== decision)),
    });
  });

  categories.forEach((category) => {
    chips.push({
      key: `category-${category}`,
      label: `Категория: ${CATEGORY_LABELS[category] ?? category}`,
      onDelete: () => onCategoriesChange(categories.filter((value) => value !== category)),
    });
  });

  if (datePreset || dateFrom || dateTo) {
    const presetLabel = datePreset
      ? DATE_PRESET_OVERRIDES[datePreset] ?? DATE_PRESET_LABELS[datePreset]
      : "";
    const rangeLabel =
      dateFrom && dateTo
        ? `Период: с ${dateFrom} по ${dateTo}`
        : dateFrom
          ? `Период: с ${dateFrom}`
          : dateTo
            ? `Период: до ${dateTo}`
            : "";
    chips.push({
      key: "period",
      label: presetLabel || rangeLabel || "Период",
      onDelete: () => {
        onDatePresetChange("");
        onDateFromChange("");
        onDateToChange("");
      },
    });
  }

  if (showRepeats) {
    chips.push({
      key: "repeats",
      label: "Повторы: включены",
      onDelete: () => onShowRepeatsChange(false),
    });
  }

  if (search) {
    chips.push({
      key: "search",
      label: `Поиск: ${search}`,
      onDelete: () => onSearchChange(""),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  const visibleChips = typeof maxVisible === "number" ? chips.slice(0, maxVisible) : chips;
  const remainingCount =
    typeof maxVisible === "number" ? Math.max(0, chips.length - maxVisible) : 0;

  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      alignItems="center"
      useFlexGap
      sx={{ rowGap: 1 }}
    >
      {visibleChips.map((chip) => {
        const labelContent = (
          <Box
            component="span"
            sx={{
              display: "block",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {chip.label}
          </Box>
        );

        return (
          <Tooltip key={chip.key} title={chip.label} arrow>
            <Chip
              size="small"
              variant="outlined"
              label={labelContent}
              onDelete={chip.onDelete}
              sx={{
                borderColor: alpha(primitives.night[500], 0.7),
                bgcolor: alpha(primitives.night[700], 0.4),
                color: primitives.night[100],
                "& .MuiChip-label": { px: 1.25, py: 0.25 },
                "& .MuiChip-deleteIcon": {
                  color: alpha(primitives.night[300], 0.9),
                  "&:hover": { color: primitives.lotus[300] },
                },
              }}
            />
          </Tooltip>
        );
      })}
      {remainingCount > 0 ? (
        <Chip
          size="small"
          variant="outlined"
          label={`ещё +${remainingCount}`}
          onClick={onExpand}
          sx={{
            borderColor: alpha(primitives.night[500], 0.7),
            bgcolor: alpha(primitives.night[700], 0.4),
            color: primitives.night[100],
            "&:hover": {
              borderColor: primitives.lotus[400],
              bgcolor: alpha(primitives.lotus[500], 0.12),
            },
          }}
        />
      ) : null}
      {onResetAll ? (
        <Box sx={{ ml: { xs: 0, md: "auto" } }}>
          <Chip
            size="small"
            variant="outlined"
            label="Сбросить всё"
            onClick={onResetAll}
            sx={{
              borderColor: alpha(primitives.lotus[500], 0.6),
              color: primitives.lotus[300],
              bgcolor: alpha(primitives.lotus[500], 0.12),
              "&:hover": { bgcolor: alpha(primitives.lotus[500], 0.2) },
            }}
          />
        </Box>
      ) : null}
    </Stack>
  );
};
