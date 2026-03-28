import { request, requestBlob } from "./client";
import { normalizeBduMatch } from "../pages/product-detail/bduUtils";
import type { BDUMatchItem, BDUMatchItemDTO } from "../types/bdu";
import type { SbomComponentItem, SbomIndexStatus, SbomItem } from "../types/sbom";

export const listSboms = async (productId: string): Promise<SbomItem[]> => {
  return request<SbomItem[]>("/api/v1/sbom", {
    query: { productId },
  });
};

export const uploadSbom = async (productId: string, file: File): Promise<SbomItem> => {
  const formData = new FormData();
  formData.append("productId", productId);
  formData.append("file", file);

  return request<SbomItem>("/api/v1/sbom/upload", {
    method: "POST",
    body: formData,
    json: false,
  });
};

export const downloadSbom = async (id: string, filename: string): Promise<void> => {
  const blob = await requestBlob(`/api/v1/sbom/${id}/download`);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const listSbomComponents = async (
  sbomId: string,
  params: {
    directOnly?: boolean;
    ecosystem?: string;
    license?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: SbomComponentItem[]; total: number }> =>
  request<{ items: SbomComponentItem[]; total: number }>(`/api/v1/sbom/${sbomId}/components`, {
    query: params,
  });

export const listProductComponents = async (
  productId: string,
  params: {
    directOnly?: boolean;
    ecosystem?: string;
    license?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: SbomComponentItem[]; total: number; indexStatus?: SbomIndexStatus | null }> =>
  request<{ items: SbomComponentItem[]; total: number; indexStatus?: SbomIndexStatus | null }>(
    `/api/v1/products/${productId}/components`,
    {
      query: params,
    }
  );

export const listProductBduVulnerabilities = async (
  productId: string,
  params: { q?: string; limit?: number; offset?: number }
): Promise<{ items: BDUMatchItem[]; total: number }> => {
  const response = await request<{ items: BDUMatchItemDTO[]; total: number }>(
    `/api/v1/products/${productId}/bdu-vulnerabilities`,
    {
      query: params,
    }
  );
  return {
    total: Number(response.total) || 0,
    items: (response.items ?? []).map((item) => normalizeBduMatch(item)),
  };
};
