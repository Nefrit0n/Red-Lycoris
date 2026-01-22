export interface ImportJobListItemDTO {
  id: string;
  scanner: string;
  sourceType?: string | null;
  sourceVersion?: string | null;
  status: string;
  progress: number;
  findingsTotal: number;
  findingsNew: number;
  duplicatesTotal: number;
  checksum: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  productId?: string | null;
  productName?: string | null;
  productVersion?: string | null;
  productIdentifier?: string | null;
  createdBy?: string | null;
}

export interface ImportJobErrorSummaryDTO {
  message: string;
}

export interface ImportJobDetailDTO extends ImportJobListItemDTO {
  errorMessage?: string | null;
  errorSummary?: ImportJobErrorSummaryDTO | null;
}

export type ImportJobDTO = ImportJobDetailDTO;
export type ImportJob = ImportJobListItemDTO;
export type ImportJobDetail = ImportJobDetailDTO;
