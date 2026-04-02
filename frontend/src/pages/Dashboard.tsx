import { useDashboardStats } from "@/api/dashboard";
import {
  StatCards,
  SeverityDistribution,
  StatusDonut,
  TopFindings,
  EnrichmentCoverageWidget,
  DashboardSkeleton,
} from "@/components/DashboardWidgets";

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const stats = data?.data;

  if (isLoading || !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <StatCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SeverityDistribution stats={stats} />
        <StatusDonut stats={stats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopFindings stats={stats} />
        <EnrichmentCoverageWidget stats={stats} />
      </div>
    </div>
  );
}
