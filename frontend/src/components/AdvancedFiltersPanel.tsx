import type { HTMLAttributes } from "react";
import { useMemo } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  Divider,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
  Button,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { primitives } from "../design-system/tokens/colors";
import {
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";
import { CATEGORY_OPTIONS, DATE_PRESET_OPTIONS } from "../features/filters/labels";
import { OCCURRENCE_LABELS, RISK_BAND_LABELS, SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";
import { SCANNER_TYPE_OPTIONS } from "../utils/scannerTypes";
import { ProductsMultiSelect } from "./ProductsMultiSelect";
import { DraftFiltersState } from "./FilterDrawer";

interface AdvancedFiltersPanelProps {
  draftFilters: DraftFiltersState;
  setDraftFilters: (value: DraftFiltersState | ((prev: DraftFiltersState) => DraftFiltersState)) => void;
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
}

const riskBandOptions = (Object.entries(RISK_BAND_LABELS) as Array<[RiskBand, string]>).map(
  ([value, label]) => ({ value, label })
);

const occurrenceOptions = (Object.entries(OCCURRENCE_LABELS) as Array<
  [FindingOccurrenceStatus, string]
>).map(([value, label]) => ({ value, label }));

const policyOptions: Array<{ value: PolicyDecision; label: string }> = [
  { value: "pass", label: "PASS" },
  { value: "warn", label: "WARN" },
  { value: "fail", label: "FAIL" },
];

const buildScannerOptions = () =>
  SCANNER_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const renderMultiOption = (props: HTMLAttributes<HTMLLIElement>, label: string, checked: boolean) => (
  <li {...props}>
    <Checkbox checked={checked} size="small" />
    {label}
  </li>
);

const SelectionActions = ({
  onSelectAll,
  onClear,
  disabled,
}: {
  onSelectAll: () => void;
  onClear: () => void;
  disabled?: boolean;
}) => (
  <Stack direction="row" spacing={1} justifyContent="flex-end">
    <Button
      size="small"
      variant="text"
      onClick={onSelectAll}
      disabled={disabled}
      sx={{ textTransform: "none", color: primitives.night[200], minHeight: 28 }}
    >
      Выбрать всё
    </Button>
    <Button
      size="small"
      variant="text"
      onClick={onClear}
      disabled={disabled}
      sx={{ textTransform: "none", color: primitives.night[200], minHeight: 28 }}
    >
      Очистить
    </Button>
  </Stack>
);

const AdvancedFiltersPanel = ({
  draftFilters,
  setDraftFilters,
  severityCounts,
  statusCounts,
}: AdvancedFiltersPanelProps) => {
  const severityOptionList = useMemo(
    () =>
      (Object.entries(SEVERITY_STYLES) as Array<[FindingSeverity, { label: string }]>).map(
        ([value, config]) => ({
          value,
          label:
            typeof severityCounts?.[value] === "number"
              ? `${config.label} (${severityCounts?.[value]})`
              : config.label,
        })
      ),
    [severityCounts]
  );

  const statusOptionList = useMemo(
    () =>
      (Object.entries(STATUS_LABELS) as Array<[FindingStatus, string]>).map(
        ([value, label]) => ({
          value,
          label:
            typeof statusCounts?.[value] === "number"
              ? `${label} (${statusCounts?.[value]})`
              : label,
        })
      ),
    [statusCounts]
  );

  const scannerOptions = useMemo(() => buildScannerOptions(), []);

  return (
    <Stack spacing={1.5}>
      <Accordion
        defaultExpanded
        sx={{
          bgcolor: alpha(primitives.night[750], 0.55),
          border: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          boxShadow: "none",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Основное
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <ProductsMultiSelect
              value={draftFilters.productIds}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, productIds: value }))}
            />
            <TextField
              label="Поиск"
              placeholder="Поиск по находкам"
              size="small"
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              fullWidth
            />
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Период
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {DATE_PRESET_OPTIONS.map((preset) => (
                  <Chip
                    key={preset.id}
                    size="small"
                    label={preset.label}
                    variant={draftFilters.datePreset === preset.id ? "filled" : "outlined"}
                    onClick={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        datePreset: preset.id,
                        dateFrom: daysAgo(preset.days),
                        dateTo: "",
                      }))
                    }
                    sx={{
                      borderColor: alpha(primitives.night[500], 0.6),
                      bgcolor:
                        draftFilters.datePreset === preset.id
                          ? alpha(primitives.lotus[500], 0.2)
                          : alpha(primitives.night[700], 0.4),
                      "&:hover": {
                        borderColor: primitives.lotus[400],
                        bgcolor: alpha(primitives.lotus[500], 0.12),
                      },
                    }}
                  />
                ))}
              </Stack>
            </Stack>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Дата от"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateFrom: event.target.value,
                      datePreset: "",
                    }))
                  }
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Дата до"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateTo: event.target.value,
                      datePreset: "",
                    }))
                  }
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: alpha(primitives.night[600], 0.5) }} />

      <Accordion
        defaultExpanded
        sx={{
          bgcolor: alpha(primitives.night[750], 0.55),
          border: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          boxShadow: "none",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Риск
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={severityOptionList}
              value={severityOptionList.filter((option) =>
                draftFilters.severities.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  severities: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Критичность" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  severities: severityOptionList.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, severities: [] }))}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={statusOptionList}
              value={statusOptionList.filter((option) =>
                draftFilters.statuses.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statuses: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Статус" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statuses: statusOptionList.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, statuses: [] }))}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={riskBandOptions}
              value={riskBandOptions.filter((option) =>
                draftFilters.riskBands.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  riskBands: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Риск" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  riskBands: riskBandOptions.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, riskBands: [] }))}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: alpha(primitives.night[600], 0.5) }} />

      <Accordion
        defaultExpanded
        sx={{
          bgcolor: alpha(primitives.night[750], 0.55),
          border: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          boxShadow: "none",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Источник
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={CATEGORY_OPTIONS}
              value={CATEGORY_OPTIONS.filter((option) =>
                draftFilters.categories.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  categories: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Категория" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  categories: CATEGORY_OPTIONS.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, categories: [] }))}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={scannerOptions}
              value={scannerOptions.filter((option) =>
                draftFilters.scannerTypes.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  scannerTypes: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Инструменты" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  scannerTypes: scannerOptions.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, scannerTypes: [] }))}
              disabled={scannerOptions.length === 0}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: alpha(primitives.night[600], 0.5) }} />

      <Accordion
        defaultExpanded={false}
        sx={{
          bgcolor: alpha(primitives.night[750], 0.55),
          border: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          boxShadow: "none",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Прочее
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={occurrenceOptions}
              value={occurrenceOptions.filter((option) =>
                draftFilters.occurrences.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  occurrences: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Повторяемость" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  occurrences: occurrenceOptions.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, occurrences: [] }))}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              limitTags={2}
              options={policyOptions}
              value={policyOptions.filter((option) =>
                draftFilters.policyDecisions.includes(option.value)
              )}
              onChange={(_, value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  policyDecisions: value.map((item) => item.value),
                }))
              }
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option, { selected }) =>
                renderMultiOption(props, option.label, selected)
              }
              renderInput={(params) => (
                <TextField {...params} label="Политика" size="small" />
              )}
            />
            <SelectionActions
              onSelectAll={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  policyDecisions: policyOptions.map((option) => option.value),
                }))
              }
              onClear={() => setDraftFilters((prev) => ({ ...prev, policyDecisions: [] }))}
            />
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Показывать повторы</Typography>
              <Switch
                checked={draftFilters.showRepeats}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    showRepeats: event.target.checked,
                  }))
                }
              />
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

export default AdvancedFiltersPanel;
