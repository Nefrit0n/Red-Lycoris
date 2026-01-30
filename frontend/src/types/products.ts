export interface ProductListItemDTO {
  id: string;
  name: string;
  identifier?: string | null;
  version?: string | null;
  assetCriticality?: string | null;
  lastScanAt?: string | null;
  findingsOpenCount: number;
}

export interface ProductDetailDTO extends ProductListItemDTO {
  description?: string | null;
}

export interface ProductStatsDTO {
  openCount: number;
  mitigatedCount: number;
  falsePositiveCount: number;
  severityCounts?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
  };
}

export type ProductDTO = ProductListItemDTO;

export interface ProductWithStats extends ProductListItemDTO {
  severityBreakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  trend?: "up" | "down" | "flat";
  trendValue?: number;
  recentScans?: {
    id: string;
    scanner: string;
    status: string;
    createdAt: string;
    findingsNew: number;
  }[];
}

export interface ProductDetailView extends ProductDetailDTO, ProductWithStats {
  totalScans: number;
  findingsFixedCount: number;
  findingsFalsePositiveCount: number;
}

export type Product = ProductListItemDTO;
export type ProductDetail = ProductDetailView;
