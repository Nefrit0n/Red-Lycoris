import { getAuthHeaders, parseApiResponse } from "./http";

export interface UploadScanRequest {
  file: File;
  scannerType: string;
  productName?: string;
  productVersion?: string;
  productIdentifier?: string;
}

export interface UploadScanResponse {
  scanId: string;
  productId?: string;
  createdFindings: number;
  duplicates: number;
  productCreated: boolean;
}

export const uploadScan = async (
  payload: UploadScanRequest
): Promise<UploadScanResponse> => {
  const formData = new FormData();
  formData.append("report", payload.file);
  formData.append("scanner_type", payload.scannerType);
  if (payload.productName) {
    formData.append("product_name", payload.productName);
  }
  if (payload.productVersion) {
    formData.append("product_version", payload.productVersion);
  }
  if (payload.productIdentifier) {
    formData.append("product_identifier", payload.productIdentifier);
  }

  const response = await fetch("/api/v1/scans/upload", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить отчёт");
  }

  return parseApiResponse<UploadScanResponse>(response);
};
