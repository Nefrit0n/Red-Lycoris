import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
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

  // держим отображаемый inputValue в синхре с текущим productId
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
      : {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "Critical",
      }[filterSeverity];

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
    filterOccurrence === ""
      ? ""
      : {
        NEW: "New",
        REPEAT: "Repeat",
      }[filterOccurrence];

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
    <Box
      component="section"
      aria-label="Фильтры списка находок"
      sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Autocomplete<Product, false, true, true>
          options={products}
          value={selectedProduct}
          inputValue={productInput}
          loading={productsLoading}
          freeSolo
          // ✅ КРИТИЧНО: правильное сравнение value с options (а не по ссылке)
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onInputChange={(_, value) => {
            // ⚠️ НЕ чистим фильтр отсюда — только отображаемый текст
            setProductInput(value);
          }}
          onChange={(_, value) => {
            // ✅ Любые реальные изменения фильтра — только тут
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
              placeholder="Название или ID продукта"
              size="small"
              inputProps={{
                ...params.inputProps,
                "aria-label": "Фильтр по продукту",
              }}
              helperText="Можно вставить ID вручную"
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
              sx={{ minWidth: 260 }}
            />
          )}
        />

        <TextField
          label="Поиск"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          size="small"
          placeholder="title / fingerprint / CVE / rule id"
          inputProps={{ "aria-label": "Поиск по находкам" }}
          sx={{ minWidth: 260 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-severity-label">Критичность</InputLabel>
          <Select
            labelId="filter-severity-label"
            label="Критичность"
            value={filterSeverity}
            onChange={handleSeverityChange}
            inputProps={{ "aria-label": "Фильтр по уровню критичности" }}
          >
            <MenuItem value="">
              <em>Все уровни</em>
            </MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-status-label">Статус</InputLabel>
          <Select
            labelId="filter-status-label"
            label="Статус"
            value={filterStatus}
            onChange={handleStatusChange}
            inputProps={{ "aria-label": "Фильтр по статусу" }}
          >
            <MenuItem value="">
              <em>Все статусы</em>
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

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-occurrence-label">Occurrence</InputLabel>
          <Select
            labelId="filter-occurrence-label"
            label="Occurrence"
            value={filterOccurrence}
            onChange={handleOccurrenceChange}
            inputProps={{ "aria-label": "Фильтр по повторяемости" }}
          >
            <MenuItem value="">
              <em>Все</em>
            </MenuItem>
            <MenuItem value="NEW">New</MenuItem>
            <MenuItem value="REPEAT">Repeat</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-scanner-label">Scanner</InputLabel>
          <Select
            labelId="filter-scanner-label"
            label="Scanner"
            value={filterScannerType}
            onChange={handleScannerChange}
            inputProps={{ "aria-label": "Фильтр по scanner" }}
          >
            <MenuItem value="">
              <em>Все</em>
            </MenuItem>
            <MenuItem value="trivy">Trivy</MenuItem>
            <MenuItem value="zap">ZAP</MenuItem>
            <MenuItem value="semgrep">Semgrep</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Last seen from"
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <TextField
          label="Last seen to"
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={showRepeats}
              onChange={(event) => onShowRepeatsChange(event.target.checked)}
              color="primary"
            />
          }
          label="Show repeats"
        />

        <Button
          variant="outlined"
          color="inherit"
          onClick={onReset}
          sx={{ alignSelf: { xs: "stretch", md: "center" } }}
        >
          Сбросить
        </Button>
      </Stack>

      {hasActiveFilters && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 2 }}
        >
          {productId && (
            <Chip
              label={`Product: ${productLabel || productId}`}
              onDelete={() => onProductIdChange("")}
            />
          )}
          {filterSeverity !== "" && severityLabel && (
            <Chip
              label={`Severity: ${severityLabel}`}
              onDelete={() => onSeverityChange("")}
            />
          )}
          {filterStatus !== "" && statusLabel && (
            <Chip
              label={`Status: ${statusLabel}`}
              onDelete={() => onStatusChange("")}
            />
          )}
          {filterOccurrence !== "" && occurrenceLabel && (
            <Chip
              label={`Occurrence: ${occurrenceLabel}`}
              onDelete={() => onOccurrenceChange("")}
            />
          )}
          {filterScannerType && (
            <Chip
              label={`Scanner: ${filterScannerType}`}
              onDelete={() => onScannerTypeChange("")}
            />
          )}
          {dateFrom && (
            <Chip label={`Last seen ≥ ${dateFrom}`} onDelete={() => onDateFromChange("")} />
          )}
          {dateTo && (
            <Chip label={`Last seen ≤ ${dateTo}`} onDelete={() => onDateToChange("")} />
          )}
          {showRepeats && (
            <Chip
              label="Show repeats"
              onDelete={() => onShowRepeatsChange(false)}
            />
          )}
          {search && (
            <Chip label={`q: ${search}`} onDelete={() => onSearchChange("")} />
          )}
        </Stack>
      )}

      {!hasActiveFilters && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Выберите фильтры, чтобы сузить список находок.
        </Typography>
      )}
    </Box>
  );
};

export default FiltersPanel;
