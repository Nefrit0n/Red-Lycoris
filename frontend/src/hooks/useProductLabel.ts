import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/products";
import { ProductListItemDTO } from "../types/products";

const PRODUCTS_FETCH_LIMIT = 200;

export const useProductLabel = (productId: string) => {
  const [products, setProducts] = useState<ProductListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadProducts = async () => {
      setLoading(true);
      try {
        const response = await fetchProducts(PRODUCTS_FETCH_LIMIT, 0, controller.signal);
        setProducts(Array.isArray(response?.data) ? response.data : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();

    return () => controller.abort();
  }, []);

  const matchedProduct = useMemo(() => {
    if (!productId) return null;
    return (
      products.find((product) => product.id === productId) ||
      products.find((product) => product.identifier === productId) ||
      null
    );
  }, [productId, products]);

  const productLabel = useMemo(() => {
    if (!productId) return "";
    if (!matchedProduct) return productId;
    const identifierSuffix = matchedProduct.identifier ? ` · ${matchedProduct.identifier}` : "";
    return `${matchedProduct.name}${identifierSuffix}`;
  }, [matchedProduct, productId]);

  return {
    productLabel,
    hasMatch: Boolean(matchedProduct),
    loading,
  };
};
