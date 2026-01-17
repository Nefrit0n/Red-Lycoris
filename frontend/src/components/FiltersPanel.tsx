import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
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

  const chipItems = useMemo(
    () => [
      productId
        ? {
            key: "product",
            label: `Продукт: ${productLabel || productId}`,
            onDelete: () => onProductIdChange(""),
          }
        : null,
      filterSeverity !== "" && severityLabel
        ? {
            key: "severity",
            label: `Критичность: ${severityLabel}`,
            onDelete: () => onSeverityChange(""),
          }
        : null,
      filterStatus !== "" && statusLabel
        ? {
            key: "status",
            label: `Статус: ${statusLabel}`,
            onDelete: () => onStatusChange(""),
          }
        : null,
      filterOccurrence !== "" && occurrenceLabel
        ? {
            key: "occurrence",
            label: `Повторяемость: ${occurrenceLabel}`,
            onDelete: () => onOccurrenceChange(""),
          }
        : null,
      filterScannerType
        ? {
            key: "scanner",
            label: `Сканер: ${filterScannerType}`,
            onDelete: () => onScannerTypeChange(""),
          }
        : null,
      dateFrom
        ? {
            key: "date-from",
            label: `Last seen ≥ ${dateFrom}`,
            onDelete: () => onDateFromChange(""),
          }
        : null,
      dateTo
        ? {
            key: "date-to",
            label: `Last seen ≤ ${dateTo}`,
            onDelete: () => onDateToChange(""),
          }
        : null,
      showRepeats
        ? {
            key: "repeats",
            label: "Повторы включены",
            onDelete: () => onShowRepeatsChange(false),
          }
        : null,
      search
        ? {
            key: "search",
            label: `Поиск: ${search}`,
            onDelete: () => onSearchChange(""),
          }
        : null,
    ],
    [
      productId,
      productLabel,
      filterSeverity,
      severityLabel,
      filterStatus,
      statusLabel,
      filterOccurrence,
      occurrenceLabel,
      filterScannerType,
      dateFrom,
      dateTo,
      showRepeats,
      search,
      onProductIdChange,
      onSeverityChange,
      onStatusChange,
      onOccurrenceChange,
      onScannerTypeChange,
      onDateFromChange,
      onDateToChange,
      onShowRepeatsChange,
      onSearchChange,
    ]
  );

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
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Фильтры
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Подберите параметры для triage и сохраняйте контекст поиска.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={onReset}
            sx={{ whiteSpace: "nowrap" }}
            disabled={!hasActiveFilters}
          >
            Сбросить все
          </Button>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(12, minmax(0, 1fr))",
            },
            alignItems: "center",
          }}
        >
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" } }}>
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
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" } }}>
            <TextField
              label="Поиск"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              size="small"
              fullWidth
              placeholder="title / fingerprint / CVE / rule id"
              inputProps={{ "aria-label": "Поиск по находкам" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
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
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
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
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
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
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
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
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
            <TextField
              label="Last seen от"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
            <TextField
              label="Last seen до"
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
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
          </Box>
        </Box>

        {hasActiveFilters ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {chipItems
              .filter((item): item is { key: string; label: string; onDelete: () => void } =>
                Boolean(item)
              )
              .map((item) => (
                <Chip
                  key={item.key}
                  size="small"
                  variant="outlined"
                  label={item.label}
                  onDelete={item.onDelete}
                />
              ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Фильтры не выбраны — показываем все доступные находки.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default FiltersPanel;
