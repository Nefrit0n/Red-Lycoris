import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/products";
import {
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";
import { Product } from "../types/products";

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
}: FiltersPanelProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productInput, setProductInput] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const response = await fetchProducts(200, 0, controller.signal);
        setProducts(Array.isArray(response?.data) ? response.data : []);
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
    return () => controller.abort();
  }, []);

  const selectedProduct = useMemo(() => {
    if (!productId) return null;
    return (
      products.find((p) => p.id === productId) ||
      products.find((p) => p.identifier === productId) ||
      null
    );
  }, [productId, products]);

  const productLabel = useMemo(() => {
    if (!productId) return "";
    if (!selectedProduct) return productId;

    const identifierSuffix = selectedProduct.identifier
      ? ` · ${selectedProduct.identifier}`
      : "";
    return `${selectedProduct.name}${identifierSuffix}`;
  }, [productId, selectedProduct]);

  // держим inputValue синхронно с выбранным продуктом
  useEffect(() => {
    setProductInput(productLabel);
  }, [productLabel]);

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

  const severityLabel =
    filterSeverity === ""
      ? ""
      : { low: "Low", medium: "Medium", high: "High", critical: "Critical" }[
      filterSeverity
      ];

  const statusLabel =
    filterStatus === ""
      ? ""
      : {
        new: "New",
        under_review: "Under review",
        confirmed: "Confirmed",
        false_positive: "False positive",
        out_of_scope: "Out of scope",
        risk_accepted: "Risk accepted",
        mitigated: "Mitigated",
        duplicate: "Duplicate",
      }[filterStatus];

  const occurrenceLabel =
    filterOccurrence === "" ? "" : { NEW: "New", REPEAT: "Repeat" }[filterOccurrence];

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
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          flexWrap="wrap"
        >
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

        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={4}>
            <Autocomplete<Product, false, true, true>
              options={products}
              value={selectedProduct}
              inputValue={productInput}
              loading={productsLoading}
              freeSolo
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onInputChange={(_, value) => {
                setProductInput(value);
              }}
              onChange={(_, value) => {
                if (typeof value === "string") {
                  onProductIdChange(value.trim());
                  return;
                }
                if (value) {
                  onProductIdChange(value.identifier || value.id);
                  return;
                }
                onProductIdChange("");
              }}
              getOptionLabel={(option) => {
                if (typeof option === "string") return option;
                return `${option.name}${option.identifier ? ` · ${option.identifier}` : ""}`;
              }}
              filterOptions={(options, state) => {
                const input = state.inputValue.toLowerCase();
                if (!input) return options;
                return options.filter((option) => {
                  const identifier = option.identifier?.toLowerCase() ?? "";
                  return (
                    option.name.toLowerCase().includes(input) ||
                    identifier.includes(input) ||
                    option.id.toLowerCase().includes(input)
                  );
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Продукт"
                  placeholder="Название / ID / Identifier"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productsLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
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
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
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
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="under_review">Under review</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="false_positive">False positive</MenuItem>
                <MenuItem value="out_of_scope">Out of scope</MenuItem>
                <MenuItem value="risk_accepted">Risk accepted</MenuItem>
                <MenuItem value="mitigated">Mitigated</MenuItem>
                <MenuItem value="duplicate">Duplicate</MenuItem>
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
                <MenuItem value="NEW">New</MenuItem>
                <MenuItem value="REPEAT">Repeat</MenuItem>
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

        {hasActiveFilters ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {productId && (
              <Chip
                size="small"
                variant="outlined"
                label={`Продукт: ${productLabel || productId}`}
                onDelete={() => onProductIdChange("")}
              />
            )}
            {filterSeverity !== "" && severityLabel && (
              <Chip
                size="small"
                variant="outlined"
                label={`Критичность: ${severityLabel}`}
                onDelete={() => onSeverityChange("")}
              />
            )}
            {filterStatus !== "" && statusLabel && (
              <Chip
                size="small"
                variant="outlined"
                label={`Статус: ${statusLabel}`}
                onDelete={() => onStatusChange("")}
              />
            )}
            {filterOccurrence !== "" && occurrenceLabel && (
              <Chip
                size="small"
                variant="outlined"
                label={`Повторяемость: ${occurrenceLabel}`}
                onDelete={() => onOccurrenceChange("")}
              />
            )}
            {filterScannerType && (
              <Chip
                size="small"
                variant="outlined"
                label={`Сканер: ${filterScannerType}`}
                onDelete={() => onScannerTypeChange("")}
              />
            )}
            {dateFrom && (
              <Chip
                size="small"
                variant="outlined"
                label={`Last seen ≥ ${dateFrom}`}
                onDelete={() => onDateFromChange("")}
              />
            )}
            {dateTo && (
              <Chip
                size="small"
                variant="outlined"
                label={`Last seen ≤ ${dateTo}`}
                onDelete={() => onDateToChange("")}
              />
            )}
            {showRepeats && (
              <Chip
                size="small"
                variant="outlined"
                label="Повторы включены"
                onDelete={() => onShowRepeatsChange(false)}
              />
            )}
            {search && (
              <Chip
                size="small"
                variant="outlined"
                label={`Поиск: ${search}`}
                onDelete={() => onSearchChange("")}
              />
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Выберите фильтры, чтобы сузить список находок.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default FiltersPanel;
