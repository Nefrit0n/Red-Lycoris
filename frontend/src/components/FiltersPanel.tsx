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
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/products";
import { FindingSeverity, FindingStatus } from "../types/findings";
import { Product } from "../types/products";

interface FiltersPanelProps {
  productId: string;
  search: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  onProductIdChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: FindingSeverity | "") => void;
  onStatusChange: (value: FindingStatus | "") => void;
  onReset: () => void;
}

const FiltersPanel = ({
  productId,
  search,
  filterSeverity,
  filterStatus,
  onProductIdChange,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
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
        setProducts(response.data);
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
    if (!productId) {
      return null;
    }
    return (
      products.find((item) => item.id === productId) ||
      products.find((item) => item.identifier === productId) ||
      null
    );
  }, [productId, products]);

  const productLabel = useMemo(() => {
    if (!selectedProduct) {
      return productId;
    }
    const identifierSuffix = selectedProduct.identifier
      ? ` · ${selectedProduct.identifier}`
      : "";
    return `${selectedProduct.name}${identifierSuffix}`;
  }, [productId, selectedProduct]);

  useEffect(() => {
    if (!productId) {
      setProductInput("");
      return;
    }
    setProductInput(productLabel);
  }, [productId, productLabel]);

  const handleSeverityChange = (event: SelectChangeEvent) => {
    onSeverityChange(event.target.value as FindingSeverity | "");
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    onStatusChange(event.target.value as FindingStatus | "");
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

  const hasActiveFilters =
    Boolean(productId) ||
    Boolean(search) ||
    filterSeverity !== "" ||
    filterStatus !== "";

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
        <Autocomplete
          options={products}
          value={selectedProduct}
          inputValue={productInput}
          onInputChange={(_, value, reason) => {
            setProductInput(value);
            if (reason === "clear") {
              onProductIdChange("");
            }
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
            if (typeof option === "string") {
              return option;
            }
            return `${option.name}${option.identifier ? ` · ${option.identifier}` : ""}`;
          }}
          filterOptions={(options, state) => {
            const input = state.inputValue.toLowerCase();
            return options.filter((option) => {
              const identifier = option.identifier?.toLowerCase() ?? "";
              return (
                option.name.toLowerCase().includes(input) ||
                identifier.includes(input) ||
                option.id.toLowerCase().includes(input)
              );
            });
          }}
          freeSolo
          loading={productsLoading}
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
              label={`Product: ${productLabel}`}
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
          {search && (
            <Chip
              label={`q: ${search}`}
              onDelete={() => onSearchChange("")}
            />
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
