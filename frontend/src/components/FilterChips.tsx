import { Button, Chip, Stack } from "@mui/material";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus, PolicyDecision, RiskBand } from "../types/findings";
import { SEVERITY_STYLES, STATUS_LABELS, OCCURRENCE_LABELS, RISK_BAND_LABELS } from "../utils/findingConstants";

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
  const chips = [];

  if (productId) {
    chips.push(
      <Chip
        key="product"
        size="small"
        variant="outlined"
        label={`Продукт: ${productLabel || productId}`}
        onDelete={() => onProductIdChange("")}
      />
    );
  }

  if (filterSeverity) {
    chips.push(
      <Chip
        key="severity"
        size="small"
        variant="outlined"
        label={`Критичность: ${SEVERITY_STYLES[filterSeverity].label}`}
        onDelete={() => onSeverityChange("")}
      />
    );
  }

  if (filterStatus) {
    chips.push(
      <Chip
        key="status"
        size="small"
        variant="outlined"
        label={`Статус: ${STATUS_LABELS[filterStatus]}`}
        onDelete={() => onStatusChange("")}
      />
    );
  }

  if (filterRiskBand) {
    chips.push(
      <Chip
        key="riskBand"
        size="small"
        variant="outlined"
        label={`Риск: ${RISK_BAND_LABELS[filterRiskBand]}`}
        onDelete={() => onRiskBandChange("")}
      />
    );
  }

  if (filterOccurrence) {
    chips.push(
      <Chip
        key="occurrence"
        size="small"
        variant="outlined"
        label={`Повторяемость: ${OCCURRENCE_LABELS[filterOccurrence]}`}
        onDelete={() => onOccurrenceChange("")}
      />
    );
  }

  if (filterScannerType) {
    chips.push(
      <Chip
        key="scanner"
        size="small"
        variant="outlined"
        label={`Сканер: ${filterScannerType}`}
        onDelete={() => onScannerTypeChange("")}
      />
    );
  }

  if (filterPolicyDecision) {
    chips.push(
      <Chip
        key="policyDecision"
        size="small"
        variant="outlined"
        label={`Политика: ${filterPolicyDecision.toUpperCase()}`}
        onDelete={() => onPolicyDecisionChange("")}
      />
    );
  }

  if (dateFrom) {
    chips.push(
      <Chip
        key="dateFrom"
        size="small"
        variant="outlined"
        label={`Обнаружено ≥ ${dateFrom}`}
        onDelete={() => onDateFromChange("")}
      />
    );
  }

  if (dateTo) {
    chips.push(
      <Chip
        key="dateTo"
        size="small"
        variant="outlined"
        label={`Обнаружено ≤ ${dateTo}`}
        onDelete={() => onDateToChange("")}
      />
    );
  }

  if (showRepeats) {
    chips.push(
      <Chip
        key="repeats"
        size="small"
        variant="outlined"
        label="Повторы включены"
        onDelete={() => onShowRepeatsChange(false)}
      />
    );
  }

  if (search) {
    chips.push(
      <Chip
        key="search"
        size="small"
        variant="outlined"
        label={`Поиск: ${search}`}
        onDelete={() => onSearchChange("")}
      />
    );
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
      {chips}
      {onResetAll ? (
        <Button size="small" variant="text" onClick={onResetAll}>
          Сбросить всё
        </Button>
      ) : null}
    </Stack>
  );
};
