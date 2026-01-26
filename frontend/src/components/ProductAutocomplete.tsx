import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/products";
import { ProductListItemDTO } from "../types/products";

interface ProductAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Reusable ProductAutocomplete component
 * Handles product selection with autocomplete functionality
 */
export const ProductAutocomplete = ({ value, onChange }: ProductAutocompleteProps) => {
  const [products, setProducts] = useState<ProductListItemDTO[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productInput, setProductInput] = useState("");

  // Load products on mount
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

  // Find selected product
  const selectedProduct = useMemo(() => {
    if (!value) return null;
    return (
      products.find((p) => p.id === value) ||
      products.find((p) => p.identifier === value) ||
      null
    );
  }, [value, products]);

  // Generate product label
  const productLabel = useMemo(() => {
    if (!value) return "";
    if (!selectedProduct) return value;

    const identifierSuffix = selectedProduct.identifier
      ? ` · ${selectedProduct.identifier}`
      : "";
    return `${selectedProduct.name}${identifierSuffix}`;
  }, [value, selectedProduct]);

  // Sync input value with selected product
  useEffect(() => {
    setProductInput(productLabel);
  }, [productLabel]);

  return (
    <Autocomplete<ProductListItemDTO, false, false, true>
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
          onChange(value.trim());
          return;
        }
        if (value) {
          onChange(value.identifier || value.id);
          return;
        }
        onChange("");
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
