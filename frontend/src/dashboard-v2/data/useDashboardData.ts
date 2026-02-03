import { useEffect, useState } from "react";
import { fetchFindings } from "../../api/findings";
import { fetchProductsWithStats } from "../../api/products";
import type { FindingListItemDTO } from "../../types/findings";
import { normalizeSeverityCounts } from "../../utils/normalizeSeverityCounts";
import type { WidgetDataState } from "../types";

type ExecutiveKpisData = {
  openFindings: number;
  criticalHigh: number;
  productsAtRisk: number | null;
  scanFreshnessMinutes: number | null;
  scanFreshnessLabel: string | null;
};

type AppSecKpisData = {
  newFindings: number | null;
  newFindingsDelta: number | null;
  mttrDays: number | null;
  mttrLabel: string | null;
  coveragePercent: number | null;
  policyPassRate: number | null;
};

const emptyState = <T,>(): WidgetDataState<T> => ({
  data: null,
  loading: false,
  error: null,
});

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return null;
  const timestamp = Date.parse(dateString);
  if (Number.isNaN(timestamp)) return null;
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return `${days} дн назад`;
};

const buildRecentActivity = (items: FindingListItemDTO[]) =>
  items.map((finding) => ({
    title: finding.title,
    meta: [finding.productName, finding.severity?.toUpperCase()]
      .filter(Boolean)
      .join(" · "),
  }));

const buildCriticalActivity = (items: FindingListItemDTO[]) =>
  items.map((finding) => ({
    title: finding.title,
    product: finding.productName ?? "—",
    severity: finding.severity?.toUpperCase() ?? "—",
    time: formatRelativeTime(finding.createdAt) ?? "—",
  }));

export const useDashboardData = () => {
  const [dataMap, setDataMap] = useState<Record<string, WidgetDataState<any>>>({});

  useEffect(() => {
    const controller = new AbortController();

    const setWidgetState = <T,>(id: string, state: WidgetDataState<T>) => {
      setDataMap((prev) => ({ ...prev, [id]: state }));
    };

    const load = async () => {
      const loadingState = { data: null, loading: true, error: null };
      [
        "kpi-open-findings",
        "kpi-critical-high",
        "kpi-products-risk",
        "kpi-scan-freshness",
        "kpi-new-findings",
        "exec-top-risky-products",
        "exec-critical-activity",
        "recent-activity",
        "top-risks",
      ].forEach((id) => setWidgetState(id, loadingState));

      try {
        const findingsResponse = await fetchFindings(
          {
            limit: 1,
            offset: 0,
            includeMeta: true,
            canonicalOnly: true,
            includeRepeats: false,
          },
          controller.signal
        );

        const severityCounts = normalizeSeverityCounts(findingsResponse.meta?.severityCounts);
        const openFindings = findingsResponse.meta?.total ?? findingsResponse.total ?? 0;
        const criticalHigh = severityCounts.critical + severityCounts.high;

        let productsAtRisk: number | null = null;
        let scanFreshnessMinutes: number | null = null;
        let scanFreshnessLabel: string | null = null;
        let topRiskyProducts: Array<{ name: string; risk: number; delta: number }> | null = null;

        try {
          const productsResponse = await fetchProductsWithStats(12, 0, controller.signal);
          const productsWithRisk = productsResponse.data.map((product) => {
            const breakdown = product.severityBreakdown;
            const risk =
              (breakdown?.critical ?? 0) * 4 +
              (breakdown?.high ?? 0) * 3 +
              (breakdown?.medium ?? 0) * 2 +
              (breakdown?.low ?? 0);
            return {
              product,
              risk,
            };
          });
          productsAtRisk = productsWithRisk.filter((item) => item.risk > 0).length;
          topRiskyProducts = productsWithRisk
            .sort((a, b) => b.risk - a.risk)
            .slice(0, 5)
            .map((item) => ({
              name: item.product.name,
              risk: Math.min(100, Math.round(item.risk)),
              delta: 0,
            }));

          const latestScan = productsResponse.data
            .flatMap((product) => product.recentScans ?? [])
            .map((scan) => scan.createdAt)
            .filter(Boolean)
            .sort()
            .pop();
          if (latestScan) {
            const diffMinutes = Math.max(
              1,
              Math.round((Date.now() - Date.parse(latestScan)) / 60000)
            );
            scanFreshnessMinutes = diffMinutes;
            scanFreshnessLabel = `Обновлено ${formatRelativeTime(latestScan) ?? ""}`.trim();
          }
        } catch {
          productsAtRisk = null;
        }

        const executiveKpis: ExecutiveKpisData = {
          openFindings,
          criticalHigh,
          productsAtRisk,
          scanFreshnessMinutes,
          scanFreshnessLabel,
        };

        setWidgetState("kpi-open-findings", {
          data: executiveKpis,
          loading: false,
          error: null,
        });
        setWidgetState("kpi-critical-high", {
          data: executiveKpis,
          loading: false,
          error: null,
        });
        setWidgetState("kpi-products-risk", {
          data: executiveKpis,
          loading: false,
          error: null,
        });
        setWidgetState("kpi-scan-freshness", {
          data: executiveKpis,
          loading: false,
          error: null,
        });

        if (topRiskyProducts && topRiskyProducts.length > 0) {
          setWidgetState("exec-top-risky-products", {
            data: topRiskyProducts,
            loading: false,
            error: null,
          });
        } else {
          setWidgetState("exec-top-risky-products", emptyState());
        }

        const recentCritical = await fetchFindings(
          {
            limit: 8,
            offset: 0,
            filterSeverity: "critical",
            sortField: "createdAt",
            sortOrder: "desc",
          },
          controller.signal
        );
        const criticalActivity = buildCriticalActivity(recentCritical.data);
        setWidgetState(
          "exec-critical-activity",
          criticalActivity.length
            ? { data: criticalActivity, loading: false, error: null }
            : emptyState()
        );

        const recentFindings = await fetchFindings(
          {
            limit: 8,
            offset: 0,
            sortField: "createdAt",
            sortOrder: "desc",
          },
          controller.signal
        );
        const recentActivity = buildRecentActivity(recentFindings.data);
        setWidgetState(
          "recent-activity",
          recentActivity.length
            ? { data: recentActivity, loading: false, error: null }
            : emptyState()
        );

        const topRisks = recentFindings.data
          .filter((finding) => Boolean(finding.severity))
          .slice(0, 6)
          .map((finding) => ({
            title: finding.title,
            severity: finding.severity?.toUpperCase() ?? "—",
            owner: finding.productName ?? "—",
          }));
        setWidgetState(
          "top-risks",
          topRisks.length ? { data: topRisks, loading: false, error: null } : emptyState()
        );

        const now = new Date();
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 7);
        const previousWeekStart = new Date(now);
        previousWeekStart.setDate(now.getDate() - 14);

        const [lastWeek, previousWeek] = await Promise.all([
          fetchFindings(
            {
              limit: 1,
              offset: 0,
              includeMeta: true,
              dateFrom: lastWeekStart.toISOString(),
              dateTo: now.toISOString(),
            },
            controller.signal
          ),
          fetchFindings(
            {
              limit: 1,
              offset: 0,
              includeMeta: true,
              dateFrom: previousWeekStart.toISOString(),
              dateTo: lastWeekStart.toISOString(),
            },
            controller.signal
          ),
        ]);

        const newFindings = lastWeek.meta?.total ?? lastWeek.total ?? 0;
        const previousFindings = previousWeek.meta?.total ?? previousWeek.total ?? 0;
        const appsecKpis: AppSecKpisData = {
          newFindings,
          newFindingsDelta: newFindings - previousFindings,
          mttrDays: null,
          mttrLabel: null,
          coveragePercent: null,
          policyPassRate: null,
        };
        setWidgetState("kpi-new-findings", {
          data: appsecKpis,
          loading: false,
          error: null,
        });
      } catch {
        [
          "kpi-open-findings",
          "kpi-critical-high",
          "kpi-products-risk",
          "kpi-scan-freshness",
          "kpi-new-findings",
          "exec-top-risky-products",
          "exec-critical-activity",
          "recent-activity",
          "top-risks",
        ].forEach((id) => setWidgetState(id, emptyState()));
      }
    };

    load();

    return () => controller.abort();
  }, []);

  return {
    dataMap,
  };
};
