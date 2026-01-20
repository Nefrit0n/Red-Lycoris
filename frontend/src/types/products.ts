export interface Product {
  id: string;
  name: string;
  identifier?: string | null;
  version?: string | null;
  lastScanAt?: string | null;
  findingsOpenCount: number;
}

export interface ProductWithStats extends Product {
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
    scannerType: string;
    status: string;
    createdAt: string;
    findingsCount: number;
  }[];
}

export interface ProductDetail extends ProductWithStats {
  description?: string;
  createdAt: string;
  updatedAt: string;
  totalScans: number;
  findingsFixedCount: number;
  findingsFalsePositiveCount: number;
}

