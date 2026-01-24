export interface SbomItem {
  id: string;
  format: string;
  sha256: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt?: string | null;
  indexStatus?: string;
  indexedAt?: string | null;
  indexError?: string | null;
  componentCount?: number;
  edgeCount?: number;
}

export interface SbomComponentItem {
  id: string;
  purl?: string | null;
  name: string;
  version?: string | null;
  ecosystem?: string | null;
  supplier?: string | null;
  licenses?: string[] | null;
  direct: boolean;

  vulnTotal: number;
  vulnCritical: number;
  vulnHigh: number;
  vulnMedium: number;
  vulnLow: number;
}

export interface SbomIndexStatus {
  status: string;
  error?: string | null;
  componentCount: number;
  edgeCount: number;
  indexedAt?: string | null;
}
