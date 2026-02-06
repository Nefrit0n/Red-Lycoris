import {
  AppBar,
  Box,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { FiltersState } from "../../filters/types";
import { countActiveFilters } from "../../filters/url";
import { CATEGORY_LABELS, LANGUAGE_LABELS } from "../../filters/labels";
import { FindingSeverity, FindingStatus } from "../../../types/findings";
import SavedViewsSelector from "../../../components/SavedViewsSelector";
import ExportMenu from "../../../components/ExportMenu";
import { FindingListItemDTO } from "../../../types/findings";
import { primitives } from "../../../design-system/tokens/colors";
import FiltersPopover from "./FiltersPopover";
import { useCategoryFacets } from "./hooks";
import ScanModesMenu from "./ScanModesMenu";

const SEVERITY_LABELS_RU: Record<FindingSeverity, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

const STATUS_LABELS_RU: Record<FindingStatus, string> = {
  new: "Новый",
  under_review: "На проверке",
  confirmed: "Подтверждено",
  false_positive: "Ложноположительное",
  out_of_scope: "Вне области",
  risk_accepted: "Риск принят",
  mitigated: "Исправлено",
  duplicate: "Дубликат",
};

interface FindingsTopBarProps {
  totalCount?: number;
  totalKnown?: boolean;
  filters: FiltersState;
  onSearchChange: (value: string) => void;
  onApplyView: (filters: Partial<FiltersState>) => void;
  exportData: FindingListItemDTO[];
  exportDisabled?: boolean;
  exportTotalCount?: number;
  exportSelectAllMatching?: boolean;
  debouncedSearch: string;
  categoryItemsOverride?: Array<{ category: string; count?: number }>;
}

const FindingsTopBar = ({
  totalCount,
  totalKnown = false,
  filters,
  onSearchChange,
  onApplyView,
  exportData,
  exportDisabled = false,
  exportTotalCount = 0,
  exportSelectAllMatching = false,
  debouncedSearch,
  categoryItemsOverride,
}: FindingsTopBarProps) => {
  const activeCount = countActiveFilters(filters);
  const { facets } = useCategoryFacets(filters, debouncedSearch);

  const categoryItems = categoryItemsOverride
    ? categoryItemsOverride
    : facets.length
      ? facets.map((facet) => ({ category: facet.category, count: facet.count }))
      : [];

  const summaryParts = [
    filters.categories.length
      ? `Категории: ${filters.categories
          .map((item) => CATEGORY_LABELS[item as keyof typeof CATEGORY_LABELS] ?? item)
          .join(", ")}`
      : null,
    filters.severities.length
      ? `Критичность: ${filters.severities
          .map((item) => SEVERITY_LABELS_RU[item as FindingSeverity] ?? item)
          .join("/")}`
      : null,
    filters.statuses.length
      ? `Статус: ${filters.statuses
          .map((item) => STATUS_LABELS_RU[item as FindingStatus] ?? item)
          .join("/")}`
      : null,
    filters.languages.length
      ? `Языки: ${filters.languages
          .map((item) => LANGUAGE_LABELS[item] ?? item)
          .join("/")}`
      : null,
  ].filter(Boolean) as string[];
  const summaryText = summaryParts.length ? `Отфильтровано: ${summaryParts.join("; ")}` : "";

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: primitives.night[800],
        borderBottom: `1px solid ${primitives.night[700]}`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: 52,
          px: { xs: 2, md: 3 },
          gap: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="h6"
              component="h1"
              sx={{ fontWeight: 600, color: primitives.night[50], flexShrink: 0 }}
            >
              Findings
            </Typography>
            {totalKnown && (
              <Typography variant="caption" sx={{ color: primitives.night[400] }}>
                {totalCount}
              </Typography>
            )}
          </Stack>

          <TextField
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            size="small"
            placeholder="Поиск"
            sx={{
              minWidth: 220,
              maxWidth: 280,
              "& .MuiInputBase-root": {
                height: 34,
                fontSize: 13,
                bgcolor: primitives.night[750],
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: primitives.night[300] }} />
                </InputAdornment>
              ),
            }}
          />

          <ScanModesMenu
            value={filters.categories}
            onChange={(next) => onApplyView({ categories: next })}
            options={categoryItems}
          />

          <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
            {summaryText && (
              <Tooltip title={summaryText}>
                <Typography
                  variant="caption"
                  sx={{
                    color: primitives.night[400],
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {summaryText}
                </Typography>
              </Tooltip>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <SavedViewsSelector currentFilters={filters} onApplyView={onApplyView} />

          <FiltersPopover
            filters={filters}
            activeCount={activeCount}
            onApply={(next) => onApplyView(next)}
            onClear={(next) => onApplyView(next)}
            debouncedSearch={debouncedSearch}
          />

          <ExportMenu
            data={exportData}
            filename="findings"
            disabled={exportDisabled}
            totalCount={exportTotalCount}
            selectAllMatching={exportSelectAllMatching}
            filters={filters}
            debouncedSearch={debouncedSearch}
          />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default FindingsTopBar;
