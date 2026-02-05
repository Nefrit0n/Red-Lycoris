import { Box, Chip, Stack, alpha } from "@mui/material";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus, PolicyDecision, RiskBand } from "../types/findings";
import { SEVERITY_STYLES, STATUS_LABELS, OCCURRENCE_LABELS, RISK_BAND_LABELS } from "../utils/findingConstants";
import { primitives } from "../design-system/tokens/colors";

interface FilterChipsProps {
  productId: string;
  productLabel: string;
  search: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  filterRiskBand: RiskBand | "";
  filterOccurrence: FindingOccurrenceStatus | "";
  filterScannerType: string;
  filterPolicyDecision: PolicyDecision | "";
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
  onProductIdChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: FindingSeverity | "") => void;
  onStatusChange: (value: FindingStatus | "") => void;
  onRiskBandChange: (value: RiskBand | "") => void;
  onOccurrenceChange: (value: FindingOccurrenceStatus | "") => void;
  onScannerTypeChange: (value: string) => void;
  onPolicyDecisionChange: (value: PolicyDecision | "") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowRepeatsChange: (value: boolean) => void;
  onResetAll?: () => void;
}

/**
 * FilterChips component - displays active filters as removable chips
 */
export const FilterChips = ({
  productId,
  productLabel,
  search,
  filterSeverity,
  filterStatus,
  filterRiskBand,
  filterOccurrence,
  filterScannerType,
  filterPolicyDecision,
  dateFrom,
  dateTo,
  showRepeats,
  onProductIdChange,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onRiskBandChange,
  onOccurrenceChange,
  onScannerTypeChange,
  onPolicyDecisionChange,
  onDateFromChange,
  onDateToChange,
  onShowRepeatsChange,
  onResetAll,
}: FilterChipsProps) => {
  const chips: Array<{
    key: string;
    label: string;
    onDelete: () => void;
  }> = [];

  if (productId) {
    chips.push({
      key: "product",
      label: `Продукт: ${productLabel || productId}`,
      onDelete: () => onProductIdChange(""),
    });
  }

  if (filterSeverity) {
    chips.push({
      key: "severity",
      label: `Критичность: ${SEVERITY_STYLES[filterSeverity].label}`,
      onDelete: () => onSeverityChange(""),
    });
  }

  if (filterStatus) {
    chips.push({
      key: "status",
      label: `Статус: ${STATUS_LABELS[filterStatus]}`,
      onDelete: () => onStatusChange(""),
    });
  }

  if (filterRiskBand) {
    chips.push({
      key: "riskBand",
      label: `Риск: ${RISK_BAND_LABELS[filterRiskBand]}`,
      onDelete: () => onRiskBandChange(""),
    });
  }

  if (filterOccurrence) {
    chips.push({
      key: "occurrence",
      label: `Повторяемость: ${OCCURRENCE_LABELS[filterOccurrence]}`,
      onDelete: () => onOccurrenceChange(""),
    });
  }

  if (filterScannerType) {
    chips.push({
      key: "scanner",
      label: `Сканер: ${filterScannerType}`,
      onDelete: () => onScannerTypeChange(""),
    });
  }

  if (filterPolicyDecision) {
    chips.push({
      key: "policyDecision",
      label: `Политика: ${filterPolicyDecision.toUpperCase()}`,
      onDelete: () => onPolicyDecisionChange(""),
    });
  }

  if (dateFrom || dateTo) {
    const rangeLabel =
      dateFrom && dateTo
        ? `Период: с ${dateFrom} по ${dateTo}`
        : dateFrom
          ? `Период: с ${dateFrom}`
          : `Период: до ${dateTo}`;
    chips.push({
      key: "period",
      label: rangeLabel,
      onDelete: () => {
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

  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      alignItems="center"
      useFlexGap
      sx={{ rowGap: 1 }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          size="small"
          variant="outlined"
          label={chip.label}
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
      ))}
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
