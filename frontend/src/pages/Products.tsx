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

  const fallbackProducts: Product[] = [
    { id: "p-1", name: "Payments API" },
    { id: "p-2", name: "Identity Gateway" },
    { id: "p-3", name: "Mobile Banking" },
    { id: "p-4", name: "Partner Integrations" },
    { id: "p-5", name: "Data Warehouse" },
    { id: "p-6", name: "Customer Portal" },
  ];

  const list = products.length ? products : fallbackProducts;

  return (
    <section className="app-section">
      <div>
        <h1 className="page-title">Products</h1>
        <p className="page-subtitle">
          Каталог продуктов и сервисов по тенантам.
        </p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Products</span>
          <span className="metric-value">{products.length || 24}</span>
          <span className="metric-trend">+3 onboarded this month</span>
        </div>
      </div>

      <div className="product-grid">
        {list.map((product, index) => (
          <div key={product.id} className="product-card">
            <div className="card-header">
              <div>
                <p className="card-title">{product.name}</p>
                <p className="product-meta">
                  Owner: Security Platform Team
                </p>
              </div>
              <span
                className={`status-pill ${
                  index % 2 === 0 ? "status-open" : "status-triage"
                }`}
              >
                {index % 2 === 0 ? "monitor" : "review"}
              </span>
            </div>

            <p className="product-meta">Last scan: 2 hours ago</p>
            <div className="flex-row">
              <span className="badge badge-low">SAST 95%</span>
              <span className="badge badge-medium">DAST 82%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Products;
