import { request } from "./client";

export interface UploadScanRequest {
  file: File;
  scannerType: string;
  productName?: string;
  productVersion?: string;
  productIdentifier?: string;
  customToolName?: string;
}

export interface UploadScanResponse {
  importJobId: string;
  scanId: string;
  productId?: string;
  createdFindings: number;
  duplicates: number;
  productCreated: boolean;
  status: string;
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
  if (payload.customToolName) {
    formData.append("custom_tool_name", payload.customToolName);
  }

  return request<UploadScanResponse>("/api/v1/scans/upload", {
    method: "POST",
    body: formData,
    json: false,
  });
};
