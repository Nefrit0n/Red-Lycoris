import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useMemo } from "react";
import { FindingOccurrenceStatus, FindingSeverity, FindingStatus } from "../types/findings";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { FilterChips } from "./FilterChips";
import { SEVERITY_STYLES, STATUS_LABELS, OCCURRENCE_LABELS } from "../utils/findingConstants";

interface FiltersPanelProps {
  productId: string;
  search: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  filterOccurrence: FindingOccurrenceStatus | "";
  filterScannerType: string;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
  onProductIdChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: FindingSeverity | "") => void;
  onStatusChange: (value: FindingStatus | "") => void;
  onOccurrenceChange: (value: FindingOccurrenceStatus | "") => void;
  onScannerTypeChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowRepeatsChange: (value: boolean) => void;
  onReset: () => void;
  showHeader?: boolean;
  showChips?: boolean;
}

const FiltersPanel = ({
  productId,
  search,
  filterSeverity,
  filterStatus,
  filterOccurrence,
  filterScannerType,
  dateFrom,
  dateTo,
  showRepeats,
  onProductIdChange,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onOccurrenceChange,
  onScannerTypeChange,
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

  const handleScannerChange = (event: SelectChangeEvent) => {
    onScannerTypeChange(event.target.value);
  };

  const hasActiveFilters =
    Boolean(productId) ||
    Boolean(search) ||
    filterSeverity !== "" ||
    filterStatus !== "" ||
    filterOccurrence !== "" ||
    Boolean(filterScannerType) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    showRepeats;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      <Stack spacing={1.5}>
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

        {/* Filter inputs */}
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={4}>
            <ProductAutocomplete value={productId} onChange={onProductIdChange} />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Поиск"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              size="small"
              fullWidth
              placeholder="title / fingerprint / CVE / rule id"
              inputProps={{ "aria-label": "Поиск по находкам" }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="filter-scanner-label">Сканер</InputLabel>
              <Select
                labelId="filter-scanner-label"
                label="Сканер"
                value={filterScannerType}
                onChange={handleScannerChange}
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                <MenuItem value="trivy">Trivy</MenuItem>
                <MenuItem value="zap">ZAP</MenuItem>
                <MenuItem value="semgrep">Semgrep</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="Last seen от"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="Last seen до"
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={showRepeats}
                  onChange={(event) => onShowRepeatsChange(event.target.checked)}
                  color="primary"
                />
              }
              label="Повторы"
              sx={{ userSelect: "none" }}
            />
          </Grid>
        </Grid>

        {/* Active filters chips */}
        {showChips ? (
          hasActiveFilters ? (
            <FilterChips
              productId={productId}
              productLabel={productId}
              search={search}
              filterSeverity={filterSeverity}
              filterStatus={filterStatus}
              filterOccurrence={filterOccurrence}
              filterScannerType={filterScannerType}
              dateFrom={dateFrom}
              dateTo={dateTo}
              showRepeats={showRepeats}
              onProductIdChange={onProductIdChange}
              onSearchChange={onSearchChange}
              onSeverityChange={onSeverityChange}
              onStatusChange={onStatusChange}
              onOccurrenceChange={onOccurrenceChange}
              onScannerTypeChange={onScannerTypeChange}
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
    </Paper>
  );
};

export default FiltersPanel;
