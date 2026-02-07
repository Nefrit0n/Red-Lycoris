import { Box, Chip, Tooltip } from "@mui/material";
import { useMemo } from "react";
import { FiltersState } from "../../filters/types";
import { CATEGORY_LABELS, DATE_PRESET_LABELS, LANGUAGE_LABELS } from "../../filters/labels";

const RISK_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  under_review: "На проверке",
  confirmed: "Подтверждено",
  false_positive: "Ложноположительное",
  out_of_scope: "Вне области",
  risk_accepted: "Риск принят",
  mitigated: "Исправлено",
  duplicate: "Дубликат",
};

const OCCURRENCE_LABELS: Record<string, string> = {
  NEW: "Новые",
  REPEAT: "Повторы",
};

const POLICY_LABELS: Record<string, string> = {
  pass: "Пройдено",
  fail: "Провалено",
  warn: "Предупр.",
};

interface ActiveFilterPillsProps {
  filters: FiltersState;
  maxVisible?: number;
  onRemove: (next: FiltersState) => void;
}

const formatDateLabel = (value: string) => {
  if (!value) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }
  const dashedMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashedMatch) {
    const [, day, month, year] = dashedMatch;
    return `${day}.${month}.${year}`;
  }
  return value;
};

const ActiveFilterPills = ({ filters, maxVisible = 6, onRemove }: ActiveFilterPillsProps) => {
  const pills = useMemo(() => {
    const items: Array<{ key: string; label: string; next: FiltersState }> = [];

    filters.productIds.forEach((value) =>
      items.push({
        key: `product-${value}`,
        label: `Продукт: ${value}`,
        next: { ...filters, productIds: filters.productIds.filter((item) => item !== value) },
      })
    );
    filters.severities.forEach((value) =>
      items.push({
        key: `severity-${value}`,
        label: `Критичность: ${SEVERITY_LABELS[value] ?? value}`,
        next: { ...filters, severities: filters.severities.filter((item) => item !== value) },
      })
    );
    filters.statuses.forEach((value) =>
      items.push({
        key: `status-${value}`,
        label: `Статус: ${STATUS_LABELS[value] ?? value}`,
        next: { ...filters, statuses: filters.statuses.filter((item) => item !== value) },
      })
    );
    filters.categories.forEach((value) =>
      items.push({
        key: `category-${value}`,
        label: `Категория: ${CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS] ?? value}`,
        next: { ...filters, categories: filters.categories.filter((item) => item !== value) },
      })
    );
    filters.scannerTypes.forEach((value) =>
      items.push({
        key: `scanner-${value}`,
        label: `Сканер: ${value}`,
        next: { ...filters, scannerTypes: filters.scannerTypes.filter((item) => item !== value) },
      })
    );
    filters.languages.forEach((value) =>
      items.push({
        key: `language-${value}`,
        label: `Язык: ${LANGUAGE_LABELS[value] ?? value}`,
        next: { ...filters, languages: filters.languages.filter((item) => item !== value) },
      })
    );
    filters.occurrences.forEach((value) =>
      items.push({
        key: `occurrence-${value}`,
        label: `Повтор: ${OCCURRENCE_LABELS[value] ?? value}`,
        next: { ...filters, occurrences: filters.occurrences.filter((item) => item !== value) },
      })
    );
    filters.riskBands.forEach((value) =>
      items.push({
        key: `risk-${value}`,
        label: `Риск: ${RISK_LABELS[value] ?? value}`,
        next: { ...filters, riskBands: filters.riskBands.filter((item) => item !== value) },
      })
    );
    filters.policyDecisions.forEach((value) =>
      items.push({
        key: `policy-${value}`,
        label: `Политика: ${POLICY_LABELS[value] ?? value}`,
        next: {
          ...filters,
          policyDecisions: filters.policyDecisions.filter((item) => item !== value),
        },
      })
    );

    if (filters.datePreset) {
      items.push({
        key: `preset-${filters.datePreset}`,
        label: `Период: ${DATE_PRESET_LABELS[filters.datePreset] ?? filters.datePreset}`,
        next: { ...filters, datePreset: "" },
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      const from = formatDateLabel(filters.dateFrom) || "—";
      const to = formatDateLabel(filters.dateTo) || "—";
      items.push({
        key: "date-range",
        label: `Дата: ${from}–${to}`,
        next: { ...filters, dateFrom: "", dateTo: "" },
      });
    }

    return items;
  }, [filters]);

  if (pills.length === 0) {
    return null;
  }

  const visible = pills.slice(0, maxVisible);
  const hiddenCount = pills.length - visible.length;

  return (
    <Box
      data-testid="findings-active-filter-pills"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        overflowX: "auto",
        maxWidth: "100%",
        py: 0.25,
        "&::-webkit-scrollbar": { height: 4 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
      }}
    >
      {visible.map((item) => (
        <Tooltip key={item.key} title={item.label}>
          <Chip
            label={item.label}
            size="small"
            onDelete={() => onRemove(item.next)}
            sx={{
              height: 24,
              fontSize: 12,
              bgcolor: "rgba(225, 29, 72, 0.12)",
              color: "text.primary",
            }}
          />
        </Tooltip>
      ))}
      {hiddenCount > 0 && (
        <Chip
          label={`+${hiddenCount}`}
          size="small"
          sx={{
            height: 24,
            fontSize: 12,
            bgcolor: "rgba(255,255,255,0.08)",
            color: "text.secondary",
          }}
        />
      )}
    </Box>
  );
};

export default ActiveFilterPills;
