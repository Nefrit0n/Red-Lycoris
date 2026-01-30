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

export interface SbomTransitiveStatus {
  status: string;
  error?: string | null;
  updatedAt?: string | null;
}

export type SbomTransitiveExposureItem = {
  id: string;
  purl?: string | null;
  name: string;
  version?: string | null;
  ecosystem?: string | null;

  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;

  maxCvssScore?: number | null;
  maxEpssScore?: number | null;
  minDistanceToAnyVuln?: number | null;
};

export type SbomTransitiveExposureResponse = {
  success: boolean;
  status: SbomTransitiveStatus;
  data: {
    items: SbomTransitiveExposureItem[];
    total: number;
    maxDepth: number;
  };
};

export type SbomPathNode = {
  id: string;
  purl?: string | null;
  name: string;
  version?: string | null;
  ecosystem?: string | null;
};

export type SbomPath = {
  depth: number;
  nodes: SbomPathNode[];
};
