export interface DashboardMetrics {
  totalOpenFindings: number;
  criticalHighFindings: number;
  fixedThisWeek: number;
  productsAtRisk: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface StatusCount {
  status: string;
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
  type: string;
  title: string;
  description?: string;
  severity?: string;
  timestamp: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  severityDistribution: SeverityCount[];
  statusDistribution: StatusCount[];
  trend: TrendPoint[];
  topProducts: ProductRisk[];
  recentActivity: RecentActivityItem[];
}
