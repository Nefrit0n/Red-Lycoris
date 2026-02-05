import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import ClearIcon from "@mui/icons-material/Clear";
import { useMemo, useState } from "react";
import { focusRing } from "../design-system/tokens";
import { primitives } from "../design-system/tokens/colors";
import { ProductAutocomplete } from "./ProductAutocomplete";
import {
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";
import { OCCURRENCE_LABELS, RISK_BAND_LABELS, SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";
import { SCANNER_TYPE_OPTIONS } from "../utils/scannerTypes";

export interface DraftFiltersState {
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
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  draftFilters: DraftFiltersState;
  setDraftFilters: (value: DraftFiltersState | ((prev: DraftFiltersState) => DraftFiltersState)) => void;
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
  activeCount: number;
  onSaveView: (name: string) => void;
}

const FilterDrawer = ({
  open,
  onClose,
  onReset,
  onApply,
  draftFilters,
  setDraftFilters,
  severityCounts,
  statusCounts,
  activeCount,
  onSaveView,
}: FilterDrawerProps) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const scannerOptions = useMemo(() => {
    const hasScanner = Boolean(draftFilters.filterScannerType);
    const hasMatch = SCANNER_TYPE_OPTIONS.some(
      (option) => option.value === draftFilters.filterScannerType
    );
    if (!hasScanner || hasMatch) return SCANNER_TYPE_OPTIONS;
    return [
      { value: draftFilters.filterScannerType, label: draftFilters.filterScannerType },
      ...SCANNER_TYPE_OPTIONS,
    ];
  }, [draftFilters.filterScannerType]);

  const selectedScanner =
    scannerOptions.find((option) => option.value === draftFilters.filterScannerType) || null;

  const formatCountLabel = (label: string, count?: number) =>
    typeof count === "number" ? `${label} (${count})` : label;

  const renderSelectClearAdornment = (visible: boolean, onClear: () => void) =>
    visible ? (
      <InputAdornment position="end">
        <IconButton size="small" onClick={onClear} edge="end" aria-label="Сбросить фильтр">
          <ClearIcon fontSize="small" />
        </IconButton>
      </InputAdornment>
    ) : null;

  const handleSeverityChange = (event: SelectChangeEvent) => {
    setDraftFilters((prev) => ({
      ...prev,
      filterSeverity: event.target.value as FindingSeverity | "",
    }));
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    setDraftFilters((prev) => ({
      ...prev,
      filterStatus: event.target.value as FindingStatus | "",
    }));
  };

  const handleRiskBandChange = (event: SelectChangeEvent) => {
    setDraftFilters((prev) => ({
      ...prev,
      filterRiskBand: event.target.value as RiskBand | "",
    }));
  };

  const handleOccurrenceChange = (event: SelectChangeEvent) => {
    setDraftFilters((prev) => ({
      ...prev,
      filterOccurrence: event.target.value as FindingOccurrenceStatus | "",
    }));
  };

  const handlePolicyDecisionChange = (event: SelectChangeEvent) => {
    setDraftFilters((prev) => ({
      ...prev,
      filterPolicyDecision: event.target.value as PolicyDecision | "",
    }));
  };

  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const quickPresets = [
    {
      id: "critical-high",
      label: "Critical/High",
      apply: () =>
        setDraftFilters((prev) => ({
          ...prev,
          filterSeverity: "high",
        })),
    },
    {
      id: "open-only",
      label: "Только открытые",
      apply: () =>
        setDraftFilters((prev) => ({
          ...prev,
          filterStatus: "new",
        })),
    },
    {
      id: "last-24h",
      label: "Последние 24 часа",
      apply: () =>
        setDraftFilters((prev) => ({
          ...prev,
          dateFrom: daysAgo(1),
          dateTo: "",
        })),
    },
    {
      id: "sca",
      label: "SCA",
      apply: () =>
        setDraftFilters((prev) => ({
          ...prev,
          filterScannerType: "SCA",
        })),
    },
    {
      id: "sast",
      label: "SAST",
      apply: () =>
        setDraftFilters((prev) => ({
          ...prev,
          filterScannerType: "SAST",
        })),
    },
  ];

  const criticalHighEnabled = draftFilters.filterSeverity === "high" || draftFilters.filterSeverity === "critical";

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", md: 460 },
            maxWidth: "100vw",
            borderTopLeftRadius: { md: 18, xs: 0 },
            borderBottomLeftRadius: { md: 18, xs: 0 },
            display: "flex",
            flexDirection: "column",
            bgcolor: primitives.night[800],
            borderLeft: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            position: "sticky",
            top: 0,
            zIndex: 2,
            borderBottom: `1px solid ${alpha(primitives.night[600], 0.7)}`,
            bgcolor: alpha(primitives.night[800], 0.92),
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Фильтры
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Активно: {activeCount}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} alignItems="center">
              <IconButton onClick={onClose} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: 2, flex: "1 1 auto", overflowY: "auto" }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Быстрые пресеты
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickPresets.map((preset) => (
                  <Chip
                    key={preset.id}
                    label={preset.label}
                    variant="outlined"
                    onClick={preset.apply}
                    sx={{
                      borderColor: alpha(primitives.night[500], 0.6),
                      bgcolor: alpha(primitives.night[700], 0.5),
                      color: primitives.night[100],
                      "&:hover": {
                        borderColor: primitives.lotus[400],
                        bgcolor: alpha(primitives.lotus[500], 0.12),
                      },
                    }}
                  />
                ))}
                <Button
                  size="small"
                  variant="text"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveDialogOpen(true)}
                  sx={{ textTransform: "none", color: primitives.night[200] }}
                >
                  Сохранить набор…
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Accordion
              defaultExpanded
              sx={{
                bgcolor: alpha(primitives.night[750], 0.6),
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
                <Stack spacing={1.5}>
                  <ProductAutocomplete
                    value={draftFilters.productId}
                    onChange={(value) =>
                      setDraftFilters((prev) => ({ ...prev, productId: value }))
                    }
                    onLabelChange={(value) =>
                      setDraftFilters((prev) => ({ ...prev, productLabel: value }))
                    }
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
                    InputProps={{
                      endAdornment: draftFilters.search ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setDraftFilters((prev) => ({ ...prev, search: "" }))}
                            edge="end"
                            aria-label="Очистить поиск"
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      Период
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {[7, 30, 90].map((days) => (
                        <Chip
                          key={days}
                          size="small"
                          label={`Последние ${days} дней`}
                          variant="outlined"
                          onClick={() =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              dateFrom: daysAgo(days),
                              dateTo: "",
                            }))
                          }
                          sx={{
                            borderColor: alpha(primitives.night[500], 0.6),
                            bgcolor: alpha(primitives.night[700], 0.4),
                            "&:hover": {
                              borderColor: primitives.lotus[400],
                              bgcolor: alpha(primitives.lotus[500], 0.12),
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Дата от"
                        type="date"
                        value={draftFilters.dateFrom}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                        }
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          endAdornment: draftFilters.dateFrom ? (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setDraftFilters((prev) => ({ ...prev, dateFrom: "" }))
                                }
                                edge="end"
                                aria-label="Очистить дату от"
                              >
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Дата до"
                        type="date"
                        value={draftFilters.dateTo}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                        }
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          endAdornment: draftFilters.dateTo ? (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setDraftFilters((prev) => ({ ...prev, dateTo: "" }))
                                }
                                edge="end"
                                aria-label="Очистить дату до"
                              >
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion
              defaultExpanded
              sx={{
                bgcolor: alpha(primitives.night[750], 0.6),
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
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="filter-severity-label">Критичность</InputLabel>
                      <Select
                        labelId="filter-severity-label"
                        value={draftFilters.filterSeverity}
                        onChange={handleSeverityChange}
                        input={
                          <OutlinedInput
                            label="Критичность"
                            endAdornment={renderSelectClearAdornment(
                              draftFilters.filterSeverity !== "",
                              () =>
                                setDraftFilters((prev) => ({ ...prev, filterSeverity: "" }))
                            )}
                          />
                        }
                      >
                        <MenuItem value="">
                          <em>Все</em>
                        </MenuItem>
                        <MenuItem value="low">
                          {formatCountLabel(SEVERITY_STYLES.low.label, severityCounts?.low)}
                        </MenuItem>
                        <MenuItem value="medium">
                          {formatCountLabel(SEVERITY_STYLES.medium.label, severityCounts?.medium)}
                        </MenuItem>
                        <MenuItem value="high">
                          {formatCountLabel(SEVERITY_STYLES.high.label, severityCounts?.high)}
                        </MenuItem>
                        <MenuItem value="critical">
                          {formatCountLabel(SEVERITY_STYLES.critical.label, severityCounts?.critical)}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="filter-status-label">Статус</InputLabel>
                      <Select
                        labelId="filter-status-label"
                        value={draftFilters.filterStatus}
                        onChange={handleStatusChange}
                        input={
                          <OutlinedInput
                            label="Статус"
                            endAdornment={renderSelectClearAdornment(
                              draftFilters.filterStatus !== "",
                              () => setDraftFilters((prev) => ({ ...prev, filterStatus: "" }))
                            )}
                          />
                        }
                      >
                        <MenuItem value="">
                          <em>Все</em>
                        </MenuItem>
                        <MenuItem value="new">
                          {formatCountLabel(STATUS_LABELS.new, statusCounts?.new)}
                        </MenuItem>
                        <MenuItem value="under_review">
                          {formatCountLabel(STATUS_LABELS.under_review, statusCounts?.under_review)}
                        </MenuItem>
                        <MenuItem value="confirmed">
                          {formatCountLabel(STATUS_LABELS.confirmed, statusCounts?.confirmed)}
                        </MenuItem>
                        <MenuItem value="false_positive">
                          {formatCountLabel(STATUS_LABELS.false_positive, statusCounts?.false_positive)}
                        </MenuItem>
                        <MenuItem value="out_of_scope">
                          {formatCountLabel(STATUS_LABELS.out_of_scope, statusCounts?.out_of_scope)}
                        </MenuItem>
                        <MenuItem value="risk_accepted">
                          {formatCountLabel(STATUS_LABELS.risk_accepted, statusCounts?.risk_accepted)}
                        </MenuItem>
                        <MenuItem value="mitigated">
                          {formatCountLabel(STATUS_LABELS.mitigated, statusCounts?.mitigated)}
                        </MenuItem>
                        <MenuItem value="duplicate">
                          {formatCountLabel(STATUS_LABELS.duplicate, statusCounts?.duplicate)}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <FormControlLabel
                  control={
                    <Switch
                      checked={criticalHighEnabled}
                      onChange={(event) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          filterSeverity: event.target.checked ? "high" : "",
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Только Critical/High"
                  sx={{ mt: 1, userSelect: "none" }}
                />
              </AccordionDetails>
            </Accordion>

            <Accordion
              defaultExpanded
              sx={{
                bgcolor: alpha(primitives.night[750], 0.6),
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
                <Autocomplete
                  options={scannerOptions}
                  value={selectedScanner}
                  freeSolo
                  onChange={(_, value) => {
                    if (typeof value === "string") {
                      setDraftFilters((prev) => ({
                        ...prev,
                        filterScannerType: value.trim(),
                      }));
                      return;
                    }
                    setDraftFilters((prev) => ({
                      ...prev,
                      filterScannerType: value?.value ?? "",
                    }));
                  }}
                  onInputChange={(_, value) => {
                    if (value === "" && draftFilters.filterScannerType) {
                      setDraftFilters((prev) => ({ ...prev, filterScannerType: "" }));
                    }
                  }}
                  getOptionLabel={(option) => {
                    if (typeof option === "string") return option;
                    return option.label;
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Сканер / источник"
                      placeholder="Все"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {draftFilters.filterScannerType ? (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setDraftFilters((prev) => ({ ...prev, filterScannerType: "" }))
                                  }
                                  edge="end"
                                  aria-label="Очистить сканер"
                                >
                                  <ClearIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </AccordionDetails>
            </Accordion>

            <Accordion
              defaultExpanded={false}
              sx={{
                bgcolor: alpha(primitives.night[750], 0.6),
                border: `1px solid ${alpha(primitives.night[600], 0.7)}`,
                boxShadow: "none",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Дополнительно
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="filter-risk-label">Риск</InputLabel>
                        <Select
                          labelId="filter-risk-label"
                          value={draftFilters.filterRiskBand}
                          onChange={handleRiskBandChange}
                          input={
                            <OutlinedInput
                              label="Риск"
                              endAdornment={renderSelectClearAdornment(
                                draftFilters.filterRiskBand !== "",
                                () => setDraftFilters((prev) => ({ ...prev, filterRiskBand: "" }))
                              )}
                            />
                          }
                        >
                          <MenuItem value="">
                            <em>Все</em>
                          </MenuItem>
                          <MenuItem value="low">{RISK_BAND_LABELS.low}</MenuItem>
                          <MenuItem value="medium">{RISK_BAND_LABELS.medium}</MenuItem>
                          <MenuItem value="high">{RISK_BAND_LABELS.high}</MenuItem>
                          <MenuItem value="critical">{RISK_BAND_LABELS.critical}</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="filter-policy-decision-label">Политика</InputLabel>
                        <Select
                          labelId="filter-policy-decision-label"
                          value={draftFilters.filterPolicyDecision}
                          onChange={handlePolicyDecisionChange}
                          input={
                            <OutlinedInput
                              label="Политика"
                              endAdornment={renderSelectClearAdornment(
                                draftFilters.filterPolicyDecision !== "",
                                () =>
                                  setDraftFilters((prev) => ({
                                    ...prev,
                                    filterPolicyDecision: "",
                                  }))
                              )}
                            />
                          }
                        >
                          <MenuItem value="">
                            <em>Все</em>
                          </MenuItem>
                          <MenuItem value="pass">PASS</MenuItem>
                          <MenuItem value="warn">WARN</MenuItem>
                          <MenuItem value="fail">FAIL</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="filter-occurrence-label">Повторяемость</InputLabel>
                        <Select
                          labelId="filter-occurrence-label"
                          value={draftFilters.filterOccurrence}
                          onChange={handleOccurrenceChange}
                          input={
                            <OutlinedInput
                              label="Повторяемость"
                              endAdornment={renderSelectClearAdornment(
                                draftFilters.filterOccurrence !== "",
                                () =>
                                  setDraftFilters((prev) => ({ ...prev, filterOccurrence: "" }))
                              )}
                            />
                          }
                        >
                          <MenuItem value="">
                            <em>Все</em>
                          </MenuItem>
                          <MenuItem value="NEW">{OCCURRENCE_LABELS.NEW}</MenuItem>
                          <MenuItem value="REPEAT">{OCCURRENCE_LABELS.REPEAT}</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={draftFilters.showRepeats}
                            onChange={(event) =>
                              setDraftFilters((prev) => ({
                                ...prev,
                                showRepeats: event.target.checked,
                              }))
                            }
                            color="primary"
                          />
                        }
                        label="Показывать повторы"
                        sx={{ userSelect: "none" }}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Box>

        <Box
          sx={{
            p: 2,
            position: "sticky",
            bottom: 0,
            zIndex: 2,
            borderTop: `1px solid ${alpha(primitives.night[600], 0.7)}`,
            bgcolor: alpha(primitives.night[800], 0.95),
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="outlined" size="small" onClick={onReset}>
              Сбросить
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={onApply}
              sx={{
                bgcolor: primitives.lotus[500],
                "&:hover": { bgcolor: primitives.lotus[600] },
                boxShadow: focusRing.subtle,
              }}
            >
              Применить
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Сохранить набор фильтров</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название набора"
            fullWidth
            value={newViewName}
            onChange={(event) => setNewViewName(event.target.value)}
            placeholder="Например, критичные за неделю"
            onKeyDown={(event) => {
              if (event.key === "Enter" && newViewName.trim()) {
                onSaveView(newViewName.trim());
                setSaveDialogOpen(false);
                setNewViewName("");
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Сохраняются текущие применённые фильтры.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
          <Button
            onClick={() => {
              if (!newViewName.trim()) return;
              onSaveView(newViewName.trim());
              setSaveDialogOpen(false);
              setNewViewName("");
            }}
            variant="contained"
            disabled={!newViewName.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FilterDrawer;
