import { DatePreset } from "../../types/filters";
import { FindingCategory } from "../../types/findings";

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  SAST: "SAST",
  SCA: "SCA",
  SECRETS: "Секреты",
  DAST: "DAST",
  CONFIG: "Конфигурации",
  IAC: "IaC",
  CONTAINER: "Контейнеры",
};

export const CATEGORY_OPTIONS: Array<{ value: FindingCategory; label: string }> = (
  Object.entries(CATEGORY_LABELS) as Array<[FindingCategory, string]>
).map(([value, label]) => ({ value, label }));

export const DATE_PRESET_OPTIONS: Array<{ id: DatePreset; label: string; days: number }> = [
  { id: "24h", label: "24 часа", days: 1 },
  { id: "7d", label: "7 дней", days: 7 },
  { id: "30d", label: "30 дней", days: 30 },
  { id: "90d", label: "90 дней", days: 90 },
];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "": "",
  ...DATE_PRESET_OPTIONS.reduce<Record<DatePreset, string>>(
    (acc, preset) => ({ ...acc, [preset.id]: preset.label }),
    {} as Record<DatePreset, string>
  ),
};
