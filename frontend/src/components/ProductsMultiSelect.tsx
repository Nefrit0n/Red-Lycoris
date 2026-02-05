import { Autocomplete, Checkbox, CircularProgress, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/products";
import { ProductListItemDTO } from "../types/products";

interface ProductsMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Multi-select product autocomplete for filters
 */
export const ProductsMultiSelect = ({ value, onChange }: ProductsMultiSelectProps) => {
  const [products, setProducts] = useState<ProductListItemDTO[]>([]);
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

  const selectedOptions = useMemo(() => {
    if (value.length === 0) return [];
    return value.map((id) => {
      const matched =
        products.find((product) => product.id === id) ||
        products.find((product) => product.identifier === id) ||
        null;
      return matched ?? id;
    });
  }, [value, products]);

  return (
    <Autocomplete<ProductListItemDTO, true, false, true>
      multiple
      disableCloseOnSelect
      limitTags={2}
      options={products}
      value={selectedOptions}
      inputValue={productInput}
      loading={productsLoading}
      freeSolo
      filterSelectedOptions
      isOptionEqualToValue={(option, value) => {
        if (typeof value === "string") {
          return option.id === value || option.identifier === value;
        }
        return option.id === value.id;
      }}
      onInputChange={(_, newInput) => {
        setProductInput(newInput);
      }}
      onChange={(_, newValue) => {
        const next = newValue
          .map((item) => {
            if (typeof item === "string") return item.trim();
            return item.identifier || item.id;
          })
          .filter(Boolean);
        onChange(Array.from(new Set(next)));
      }}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        return `${option.name}${option.identifier ? ` · ${option.identifier}` : ""}`;
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox checked={selected} size="small" />
          {typeof option === "string"
            ? option
            : `${option.name}${option.identifier ? ` · ${option.identifier}` : ""}`}
        </li>
      )}
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
          label="Продукты"
          placeholder="Название / ID / Identifier"
          size="small"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {productsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
