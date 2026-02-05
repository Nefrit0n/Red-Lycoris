import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Autocomplete,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useMemo } from "react";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus, PolicyDecision, RiskBand } from "../types/findings";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { FilterChips } from "./FilterChips";
import { SEVERITY_STYLES, STATUS_LABELS, OCCURRENCE_LABELS, RISK_BAND_LABELS } from "../utils/findingConstants";
import { SCANNER_TYPE_OPTIONS } from "../utils/scannerTypes";

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

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      {showHeader ? (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Фильтры
          </Typography>

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
        </Box>
      ) : null}

      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Основные
          </Typography>
          <Stack spacing={1.5}>
            <ProductAutocomplete
              value={productId}
              onChange={onProductIdChange}
              onLabelChange={onProductLabelChange}
            />
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Классификация
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="filter-severity-label">Критичность</InputLabel>
                <Select
                  labelId="filter-severity-label"
                  label="Критичность"
                  value={filterSeverity}
                  onChange={handleSeverityChange}
                >
                  <MenuItem value="">
                    <em>Все</em>
                  </MenuItem>
                  <MenuItem value="low">{SEVERITY_STYLES.low.label}</MenuItem>
                  <MenuItem value="medium">{SEVERITY_STYLES.medium.label}</MenuItem>
                  <MenuItem value="high">{SEVERITY_STYLES.high.label}</MenuItem>
                  <MenuItem value="critical">{SEVERITY_STYLES.critical.label}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="filter-risk-label">Риск</InputLabel>
                <Select
                  labelId="filter-risk-label"
                  label="Риск"
                  value={filterRiskBand}
                  onChange={handleRiskBandChange}
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
                <InputLabel id="filter-status-label">Статус</InputLabel>
                <Select
                  labelId="filter-status-label"
                  label="Статус"
                  value={filterStatus}
                  onChange={handleStatusChange}
                >
                  <MenuItem value="">
                    <em>Все</em>
                  </MenuItem>
                  <MenuItem value="new">{STATUS_LABELS.new}</MenuItem>
                  <MenuItem value="under_review">{STATUS_LABELS.under_review}</MenuItem>
                  <MenuItem value="confirmed">{STATUS_LABELS.confirmed}</MenuItem>
                  <MenuItem value="false_positive">{STATUS_LABELS.false_positive}</MenuItem>
                  <MenuItem value="out_of_scope">{STATUS_LABELS.out_of_scope}</MenuItem>
                  <MenuItem value="risk_accepted">{STATUS_LABELS.risk_accepted}</MenuItem>
                  <MenuItem value="mitigated">{STATUS_LABELS.mitigated}</MenuItem>
                  <MenuItem value="duplicate">{STATUS_LABELS.duplicate}</MenuItem>
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
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="filter-policy-decision-label">Политика</InputLabel>
                <Select
                  labelId="filter-policy-decision-label"
                  label="Политика"
                  value={filterPolicyDecision}
                  onChange={handlePolicyDecisionChange}
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
                  label="Повторяемость"
                  value={filterOccurrence}
                  onChange={handleOccurrenceChange}
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
              />
            </Grid>
          </Grid>
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
    </Stack>
  );
};

export default FiltersPanel;
