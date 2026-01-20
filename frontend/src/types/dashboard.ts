import { FindingSeverity, FindingStatus } from "./findings";

export interface DashboardMetrics {
  totalOpenFindings: number;
  criticalHighFindings: number;
  fixedThisWeek: number;
  productsAtRisk: number;
}

export interface SeverityDistribution {
  severity: FindingSeverity;
  count: number;
}

export interface StatusDistribution {
  status: FindingStatus;
  count: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ProductRisk {
  id: string;
  name: string;
  identifier?: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
}

export interface RecentActivityItem {
  id: string;
  type: "new_finding" | "status_change" | "scan_upload";
  title: string;
  description?: string;
  severity?: string;
  timestamp: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  severityDistribution: SeverityDistribution[];
  statusDistribution: StatusDistribution[];
  trend: TrendPoint[];
  topProducts: ProductRisk[];
  recentActivity: RecentActivityItem[];
}
