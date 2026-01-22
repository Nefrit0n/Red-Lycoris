import { request, requestBlob } from "./client";
import { SbomItem } from "../types/sbom";

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
