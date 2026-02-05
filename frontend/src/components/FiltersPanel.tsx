import {
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  MenuItem,
  Autocomplete,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SaveIcon from "@mui/icons-material/Save";
import ClearIcon from "@mui/icons-material/Clear";
import { useMemo, useState } from "react";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus, PolicyDecision, RiskBand } from "../types/findings";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { FilterChips } from "./FilterChips";
import { SEVERITY_STYLES, STATUS_LABELS, OCCURRENCE_LABELS, RISK_BAND_LABELS } from "../utils/findingConstants";
import { SCANNER_TYPE_OPTIONS } from "../utils/scannerTypes";
import { useSavedViews } from "../hooks/useSavedViews";

const FILTER_PRESETS = [
  {
    id: "new",
    label: "New",
    apply: {
      filterStatus: "new" as FindingStatus,
      filterSeverity: "" as FindingSeverity | "",
    },
  },
  {
    id: "high-plus",
    label: "High+",
    apply: {
      filterSeverity: "high" as FindingSeverity,
    },
  },
  {
    id: "false-positive",
    label: "False Positive",
    apply: {
      filterStatus: "false_positive" as FindingStatus,
    },
  },
];

interface FiltersPanelProps {
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
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
  onProductIdChange: (value: string) => void;
  onProductLabelChange: (value: string) => void;
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
  onReset: () => void;
  showHeader?: boolean;
  showChips?: boolean;
}

const FiltersPanel = ({
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
  severityCounts,
  statusCounts,
  onProductIdChange,
  onProductLabelChange,
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
  onReset,
  showHeader = true,
  showChips = true,
}: FiltersPanelProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const { saveView } = useSavedViews();

  const handleSeverityChange = (event: SelectChangeEvent) => {
    onSeverityChange(event.target.value as FindingSeverity | "");
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    onStatusChange(event.target.value as FindingStatus | "");
  };

  const handleOccurrenceChange = (event: SelectChangeEvent) => {
    onOccurrenceChange(event.target.value as FindingOccurrenceStatus | "");
  };

  const handleRiskBandChange = (event: SelectChangeEvent) => {
    onRiskBandChange(event.target.value as RiskBand | "");
  };

  const handlePolicyDecisionChange = (event: SelectChangeEvent) => {
    onPolicyDecisionChange(event.target.value as PolicyDecision | "");
  };

  const scannerOptions = useMemo(() => {
    const hasScanner = Boolean(filterScannerType);
    const hasMatch = SCANNER_TYPE_OPTIONS.some((option) => option.value === filterScannerType);
    if (!hasScanner || hasMatch) return SCANNER_TYPE_OPTIONS;
    return [
      { value: filterScannerType, label: filterScannerType },
      ...SCANNER_TYPE_OPTIONS,
    ];
  }, [filterScannerType]);

  const selectedScanner =
    scannerOptions.find((option) => option.value === filterScannerType) || null;

  const hasActiveFilters =
    Boolean(productId) ||
    Boolean(search) ||
    filterSeverity !== "" ||
    filterStatus !== "" ||
    filterRiskBand !== "" ||
    filterOccurrence !== "" ||
    Boolean(filterScannerType) ||
    filterPolicyDecision !== "" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    showRepeats;

  const handleOpenSaveDialog = () => {
    setNewViewName("");
    setSaveDialogOpen(true);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    saveView(newViewName.trim(), {
      productId,
      searchInput: search,
      filterSeverity,
      filterStatus,
      filterRiskBand,
      filterOccurrence,
      filterScannerType,
      filterPolicyDecision,
      dateFrom,
      dateTo,
      showRepeats,
    });
    setSaveDialogOpen(false);
    setNewViewName("");
  };

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

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      {showHeader ? (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Фильтры
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleOpenSaveDialog}
              disabled={!hasActiveFilters}
              sx={{ whiteSpace: "nowrap" }}
            >
              Сохранить набор фильтров
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={onReset}
              sx={{ whiteSpace: "nowrap" }}
            >
              Сбросить
            </Button>
          </Stack>
        </Box>
      ) : null}

      <Stack spacing={2.5}>
        {!showHeader ? (
          <Box display="flex" justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleOpenSaveDialog}
              disabled={!hasActiveFilters}
              sx={{ whiteSpace: "nowrap" }}
            >
              Сохранить набор фильтров
            </Button>
          </Box>
        ) : null}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Быстрые
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="small"
                variant="outlined"
                onClick={() => {
                  if (preset.apply.filterStatus !== undefined) {
                    onStatusChange(preset.apply.filterStatus);
                  }
                  if (preset.apply.filterSeverity !== undefined) {
                    onSeverityChange(preset.apply.filterSeverity);
                  }
                }}
                sx={{ textTransform: "none" }}
              >
                {preset.label}
              </Button>
            ))}
          </Stack>
          <Stack spacing={1.5}>
            <ProductAutocomplete
              value={productId}
              onChange={onProductIdChange}
              onLabelChange={onProductLabelChange}
            />
            <TextField
              label="Поиск"
              placeholder="Поиск по находкам"
              size="small"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              fullWidth
              InputProps={{
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => onSearchChange("")}
                      edge="end"
                      aria-label="Очистить поиск"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Stack>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="filter-severity-label">Критичность</InputLabel>
                <Select
                  labelId="filter-severity-label"
                  value={filterSeverity}
                  onChange={handleSeverityChange}
                  input={
                    <OutlinedInput
                      label="Критичность"
                      endAdornment={renderSelectClearAdornment(
                        filterSeverity !== "",
                        () => onSeverityChange("")
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
                  value={filterStatus}
                  onChange={handleStatusChange}
                  input={
                    <OutlinedInput
                      label="Статус"
                      endAdornment={renderSelectClearAdornment(
                        filterStatus !== "",
                        () => onStatusChange("")
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
        </Box>

        <Divider />

        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Продвинутые
            </Typography>
            <Button
              variant="text"
              size="small"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              {advancedOpen ? "Скрыть" : "Показать"}
            </Button>
          </Box>
          <Divider sx={{ mt: 1.5 }} />
          <Collapse in={advancedOpen} timeout="auto" unmountOnExit>
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Классификация
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="filter-risk-label">Риск</InputLabel>
                      <Select
                        labelId="filter-risk-label"
                        value={filterRiskBand}
                        onChange={handleRiskBandChange}
                        input={
                          <OutlinedInput
                            label="Риск"
                            endAdornment={renderSelectClearAdornment(
                              filterRiskBand !== "",
                              () => onRiskBandChange("")
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
                    <Autocomplete
                      options={scannerOptions}
                      value={selectedScanner}
                      freeSolo
                      onChange={(_, value) => {
                        if (typeof value === "string") {
                          onScannerTypeChange(value.trim());
                          return;
                        }
                        onScannerTypeChange(value?.value ?? "");
                      }}
                      onInputChange={(_, value) => {
                        if (value === "" && filterScannerType) {
                          onScannerTypeChange("");
                        }
                      }}
                      getOptionLabel={(option) => {
                        if (typeof option === "string") return option;
                        return option.label;
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Сканер"
                          placeholder="Все"
                          size="small"
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {filterScannerType ? (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() => onScannerTypeChange("")}
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
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="filter-policy-decision-label">Политика</InputLabel>
                      <Select
                        labelId="filter-policy-decision-label"
                        value={filterPolicyDecision}
                        onChange={handlePolicyDecisionChange}
                        input={
                          <OutlinedInput
                            label="Политика"
                            endAdornment={renderSelectClearAdornment(
                              filterPolicyDecision !== "",
                              () => onPolicyDecisionChange("")
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
                </Grid>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Повторы
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="filter-occurrence-label">Повторяемость</InputLabel>
                      <Select
                        labelId="filter-occurrence-label"
                        value={filterOccurrence}
                        onChange={handleOccurrenceChange}
                        input={
                          <OutlinedInput
                            label="Повторяемость"
                            endAdornment={renderSelectClearAdornment(
                              filterOccurrence !== "",
                              () => onOccurrenceChange("")
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
                          checked={showRepeats}
                          onChange={(event) => onShowRepeatsChange(event.target.checked)}
                          color="primary"
                        />
                      }
                      label="Показывать повторы"
                      sx={{ userSelect: "none" }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Даты
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Последнее обнаружение от"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => onDateFromChange(event.target.value)}
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: dateFrom ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => onDateFromChange("")}
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
                      label="Последнее обнаружение до"
                      type="date"
                      value={dateTo}
                      onChange={(event) => onDateToChange(event.target.value)}
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: dateTo ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => onDateToChange("")}
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
              </Box>
            </Stack>
          </Collapse>
        </Box>
      </Stack>

      {/* Active filters chips */}
      {showChips ? (
        hasActiveFilters ? (
          <FilterChips
            productId={productId}
            productLabel={productLabel}
            search={search}
            filterSeverity={filterSeverity}
            filterStatus={filterStatus}
            filterRiskBand={filterRiskBand}
            filterOccurrence={filterOccurrence}
            filterScannerType={filterScannerType}
            filterPolicyDecision={filterPolicyDecision}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showRepeats={showRepeats}
            onProductIdChange={onProductIdChange}
            onSearchChange={onSearchChange}
            onSeverityChange={onSeverityChange}
            onStatusChange={onStatusChange}
            onRiskBandChange={onRiskBandChange}
            onOccurrenceChange={onOccurrenceChange}
            onScannerTypeChange={onScannerTypeChange}
            onPolicyDecisionChange={onPolicyDecisionChange}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
            onShowRepeatsChange={onShowRepeatsChange}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Выберите фильтры, чтобы сузить список находок.
          </Typography>
        )
      ) : null}

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
            placeholder="Например, Критичные за неделю"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSaveView();
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Текущие фильтры будут сохранены в этом наборе.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveView} variant="contained" disabled={!newViewName.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default FiltersPanel;
