import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { Product } from "../api/types";

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    apiClient
      .get<Product[]>("/v1/products")
      .then((response) => setProducts(response.data))
      .catch(() => setProducts([]));
  }, []);

  return (
    <section>
      <h1>Products</h1>
      <p>Каталог продуктов и сервисов по тенантам.</p>
      <ul>
        {products.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </section>
  );
};

export default Products;
