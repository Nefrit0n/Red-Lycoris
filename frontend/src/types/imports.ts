export interface ImportJob {
  id: string;
  scanner: string;
  status: string;
  findingsTotal: number;
  findingsNew: number;
  duplicatesTotal: number;
  checksum: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  productName?: string | null;
  productVersion?: string | null;
  productIdentifier?: string | null;
  createdBy?: string | null;
}

export interface ImportJobDetail extends ImportJob {
  errorMessage?: string | null;
}
