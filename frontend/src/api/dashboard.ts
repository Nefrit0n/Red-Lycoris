import { format, subDays } from "date-fns";
import { fetchFindings } from "./findings";
import { fetchProducts } from "./products";
import { fetchImportJobs } from "./importJobs";
import {
  DashboardData,
  DashboardMetricsDTO,
  SeverityDistribution,
  StatusDistribution,
  TrendPoint,
  ProductRisk,
  RecentActivityItem,
  RiskMetricsDTO,
} from "../types/dashboard";
import { FindingListItemDTO, FindingSeverity, FindingStatus } from "../types/findings";
import { request } from "./client";

const OPEN_STATUSES: FindingStatus[] = ["new", "under_review", "confirmed"];
const SEVERITIES: FindingSeverity[] = ["critical", "high", "medium", "low"];
const ALL_STATUSES: FindingStatus[] = [
  "new",
  "under_review",
  "confirmed",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "mitigated",
];

/**
 * Fetch all dashboard data in parallel
 */
export const fetchDashboardData = async (signal?: AbortSignal): Promise<DashboardData> => {
  // Fetch base data in parallel
  const [
    allFindingsResponse,
    productsResponse,
    importJobsResponse,
    mitigatedThisWeekResponse,
  ] = await Promise.all([
    // Get all open findings (first 1000 for aggregation)
    fetchFindings(
      {
        limit: 1000,
        offset: 0,
        canonicalOnly: true,
      },
      signal
    ),
    // Get products
    fetchProducts(100, 0, signal),
    // Get recent import jobs for activity
    fetchImportJobs({ limit: 10, offset: 0 }, signal),
    // Get findings mitigated this week
    fetchFindings(
      {
        limit: 100,
        offset: 0,
        filterStatus: "mitigated",
        dateFrom: format(subDays(new Date(), 7), "dd-MM-yyyy"),
      },
      signal
    ),
  ]);

  const allFindings = allFindingsResponse.data;
  const products = productsResponse.data;
  const importJobs = importJobsResponse.data;
  const mitigatedFindings = mitigatedThisWeekResponse.data;

  // Calculate metrics
  const openFindings = allFindings.filter((f) =>
    OPEN_STATUSES.includes(f.status)
  );
  const criticalHighFindings = openFindings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  );

  // Count products with critical/high findings
  const productsWithRisk = new Set(
    criticalHighFindings.map((f) => f.productId).filter(Boolean)
  );

  const metrics: DashboardMetricsDTO = {
    totalOpenFindings: openFindings.length,
    criticalHighFindings: criticalHighFindings.length,
    fixedThisWeek: mitigatedFindings.length,
    productsAtRisk: productsWithRisk.size,
  };

  // Calculate severity distribution
  const severityDistribution: SeverityDistribution[] = SEVERITIES.map((severity) => ({
    severity,
    count: openFindings.filter((f) => f.severity === severity).length,
  }));

  // Calculate status distribution
  const statusDistribution: StatusDistribution[] = ALL_STATUSES.map((status) => ({
    status,
    count: allFindings.filter((f) => f.status === status).length,
  }));

  // Calculate trend (last 30 days) - simplified using createdAt dates
  const trend = calculateTrend(allFindings);

  // Calculate top products by risk
  const topProducts = calculateTopProducts(openFindings, products);

  // Build recent activity from findings and import jobs
  const recentActivity = buildRecentActivity(allFindings, importJobs);

  return {
    metrics,
    severityDistribution,
    statusDistribution,
    trend,
    topProducts,
    recentActivity,
    riskMetrics: null,
  };
};

export const fetchRiskMetrics = async (
  params: {
    productId?: string;
    from?: string;
    to?: string;
    status?: string;
  },
  signal?: AbortSignal
): Promise<RiskMetricsDTO> => {
  const searchParams = new URLSearchParams();
  if (params.productId) searchParams.set("productId", params.productId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.status) searchParams.set("status", params.status);

  return request<RiskMetricsDTO>("/api/v1/metrics/risk", {
    signal,
    query: searchParams,
  });
};

/**
 * Calculate findings trend over last 30 days
 */
function calculateTrend(findings: FindingListItemDTO[]): TrendPoint[] {
  const today = new Date();
  const trend: TrendPoint[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, "dd-MM-yyyy");
    const displayDate = format(date, "dd.MM");

    // Count findings that existed on this date
    // (created before or on this date and not mitigated before this date)
    const findingsOnDate = findings.filter((f) => {
      const createdAt = new Date(f.createdAt);
      return createdAt <= date;
    });

    const point: TrendPoint = {
      date: displayDate,
      total: findingsOnDate.length,
      critical: findingsOnDate.filter((f) => f.severity === "critical").length,
      high: findingsOnDate.filter((f) => f.severity === "high").length,
      medium: findingsOnDate.filter((f) => f.severity === "medium").length,
      low: findingsOnDate.filter((f) => f.severity === "low").length,
    };

    trend.push(point);
  }

  return trend;
}

/**
 * Calculate top products by risk score
 */
function calculateTopProducts(
  findings: FindingListItemDTO[],
  products: Array<{ id: string; name: string; identifier?: string | null }>
): ProductRisk[] {
  const productMap = new Map<string, ProductRisk>();

  // Initialize from products list
  products.forEach((p) => {
    productMap.set(p.id, {
      id: p.id,
      name: p.name,
      identifier: p.identifier ?? undefined,
      findingsCount: 0,
      criticalCount: 0,
      highCount: 0,
    });
  });

  // Count findings per product
  findings.forEach((f) => {
    if (!f.productId) return;

    let product = productMap.get(f.productId);
    if (!product) {
      product = {
        id: f.productId,
        name: f.productName || "Unknown Product",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
      };
      productMap.set(f.productId, product);
    }

    product.findingsCount++;
    if (f.severity === "critical") product.criticalCount++;
    if (f.severity === "high") product.highCount++;
  });

  // Sort by risk score and return top products
  return Array.from(productMap.values())
    .filter((p) => p.findingsCount > 0)
    .sort((a, b) => {
      const aScore = a.criticalCount * 10 + a.highCount * 5 + a.findingsCount;
      const bScore = b.criticalCount * 10 + b.highCount * 5 + b.findingsCount;
      return bScore - aScore;
    })
    .slice(0, 5);
}

/**
 * Build recent activity feed
 */
function buildRecentActivity(
  findings: FindingListItemDTO[],
  importJobs: Array<{
    id: string;
    scanner: string;
    productName?: string | null;
    findingsNew: number;
    createdAt: string;
  }>
): RecentActivityItem[] {
  const activities: RecentActivityItem[] = [];

  // Add recent findings (sorted by createdAt)
  const recentFindings = [...findings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  recentFindings.forEach((f) => {
    activities.push({
      id: `finding-${f.id}`,
      type: "new_finding",
      title: f.title.length > 50 ? f.title.slice(0, 50) + "..." : f.title,
      description: f.productName || undefined,
      severity: f.severity,
      timestamp: f.createdAt,
    });
  });

  // Add recent import jobs as scan uploads
  importJobs.forEach((job) => {
    activities.push({
      id: `import-${job.id}`,
      type: "scan_upload",
      title: `${job.scanner} scan uploaded`,
      description: job.productName
        ? `${job.productName} - ${job.findingsNew || 0} new findings`
        : `${job.findingsNew || 0} new findings`,
      timestamp: job.createdAt,
    });
  });

  // Sort by timestamp and return top items
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}
