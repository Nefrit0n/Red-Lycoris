import { getAuthHeaders, parseApiResponse } from "./http";
import { SbomItem } from "../types/sbom";

export const listSboms = async (productId: string): Promise<SbomItem[]> => {
  const response = await fetch(`/api/v1/sbom?productId=${encodeURIComponent(productId)}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return parseApiResponse<SbomItem[]>(response);
};

export const uploadSbom = async (productId: string, file: File): Promise<SbomItem> => {
  const formData = new FormData();
  formData.append("productId", productId);
  formData.append("file", file);

  const response = await fetch("/api/v1/sbom/upload", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });
  return parseApiResponse<SbomItem>(response);
};

export const downloadSbom = async (id: string, filename: string): Promise<void> => {
  const response = await fetch(`/api/v1/sbom/${id}/download`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error("Failed to download SBOM");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
