import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/client";
import type { Finding } from "@/types";

interface SeverityCount {
  severity: number;
  count: number;
}

interface StatusCount {
  status: number;
  count: number;
}

interface EnrichmentCoverage {
  nvd: number;
  epss: number;
  kev: number;
  bdu: number;
}

export interface DashboardStats {
  total_findings: number;
  total_open: number;
  total_critical_open: number;
  new_this_week: number;
  by_severity: SeverityCount[];
  by_status: StatusCount[];
  top_findings: Finding[];
  enrichment_coverage: EnrichmentCoverage;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () =>
      apiGet<{ data: DashboardStats }>("/api/v1/dashboard/stats"),
    refetchInterval: 60_000,
  });
}
