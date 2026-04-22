import { useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SeverityBadge from "@/components/SeverityBadge";
import type { DashboardStats } from "@/api/dashboard";
import { cn } from "@/lib/utils";

// ---------- Stat Cards ----------

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

function StatCard({ title, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={cn("rounded-lg p-2.5", accent)}>
          <Icon className="size-5 text-current" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{title}</p>
          <p className="text-2xl font-bold tabular-nums text-zinc-100">
            {value.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Всего находок"
        value={stats.total_findings}
        icon={Shield}
        accent="bg-red-600/15 text-red-500"
      />
      <StatCard
        title="Открытые"
        value={stats.total_open}
        icon={AlertTriangle}
        accent="bg-blue-500/15 text-blue-400"
      />
      <StatCard
        title="Критические открытые"
        value={stats.total_critical_open}
        icon={ShieldAlert}
        accent="bg-red-500/15 text-red-400"
      />
      <StatCard
        title="Новые за неделю"
        value={stats.new_this_week}
        icon={TrendingUp}
        accent="bg-emerald-500/15 text-emerald-400"
      />
    </div>
  );
}

// ---------- Severity Distribution ----------

const severityConfig: Record<number, { label: string; color: string }> = {
  0: { label: "Инфо", color: "bg-zinc-500" },
  1: { label: "Низкая", color: "bg-blue-500" },
  2: { label: "Средняя", color: "bg-yellow-500" },
  3: { label: "Высокая", color: "bg-orange-500" },
  4: { label: "Критическая", color: "bg-red-500" },
};

export function SeverityDistribution({ stats }: { stats: DashboardStats }) {
  const total = stats.by_severity.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-300">
          Распределение по критичности
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-4 overflow-hidden rounded-full bg-zinc-800">
          {[4, 3, 2, 1, 0].map((sev) => {
            const item = stats.by_severity.find((s) => s.severity === sev);
            const count = item?.count ?? 0;
            if (count === 0 || total === 0) return null;
            const pct = (count / total) * 100;
            return (
              <div
                key={sev}
                className={cn("transition-all", severityConfig[sev].color)}
                style={{ width: `${pct}%` }}
                title={`${severityConfig[sev].label}: ${count}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {[4, 3, 2, 1, 0].map((sev) => {
            const item = stats.by_severity.find((s) => s.severity === sev);
            const count = item?.count ?? 0;
            return (
              <div key={sev} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "size-2.5 rounded-full",
                    severityConfig[sev].color,
                  )}
                />
                <span className="text-zinc-400">{severityConfig[sev].label}</span>
                <span className="tabular-nums text-zinc-500">
                  {count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Status Donut ----------

const statusConfig: Record<number, { label: string; color: string; stroke: string }> = {
  0: { label: "Открыта", color: "text-blue-400", stroke: "#60a5fa" },
  1: { label: "Подтверждена", color: "text-red-500", stroke: "#ef4444" },
  2: { label: "Ложное срабатывание", color: "text-zinc-400", stroke: "#71717a" },
  3: { label: "Устранена", color: "text-emerald-400", stroke: "#34d399" },
  4: { label: "Риск принят", color: "text-amber-400", stroke: "#fbbf24" },
};

export function StatusDonut({ stats }: { stats: DashboardStats }) {
  const total = stats.by_status.reduce((sum, s) => sum + s.count, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = stats.by_status
    .filter((s) => s.count > 0)
    .map((s) => {
      const pct = total > 0 ? s.count / total : 0;
      const dashLen = pct * circumference;
      const seg = {
        status: s.status,
        count: s.count,
        dashLen,
        offset,
        stroke: statusConfig[s.status]?.stroke ?? "#71717a",
      };
      offset += dashLen;
      return seg;
    });

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-300">
          Распределение по статусу
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        {/* SVG donut */}
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#27272a"
              strokeWidth="12"
            />
            {segments.map((seg) => (
              <circle
                key={seg.status}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={seg.stroke}
                strokeWidth="12"
                strokeDasharray={`${seg.dashLen} ${circumference - seg.dashLen}`}
                strokeDashoffset={-seg.offset}
                transform="rotate(-90 50 50)"
                className="transition-all duration-300"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-zinc-100">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 text-xs">
          {[0, 1, 2, 3, 4].map((st) => {
            const item = stats.by_status.find((s) => s.status === st);
            const count = item?.count ?? 0;
            const cfg = statusConfig[st];
            return (
              <div key={st} className="flex items-center gap-2">
                <div
                  className="size-2.5 rounded-full"
                  style={{ background: cfg.stroke }}
                />
                <span className="w-24 text-zinc-400">{cfg.label}</span>
                <span className="tabular-nums text-zinc-500">
                  {count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Top Findings ----------

export function TopFindings({ stats }: { stats: DashboardStats }) {
  const navigate = useNavigate();

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-300">
          Топ находок по приоритету
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-800/60">
          {stats.top_findings.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/findings/${f.id}`)}
              className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-zinc-800/40"
            >
              <SeverityBadge severity={f.severity} />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                {f.title}
              </span>
              {f.priority_score != null && (
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-medium",
                    f.priority_score >= 8
                      ? "text-red-400"
                      : f.priority_score >= 5
                        ? "text-orange-400"
                        : "text-zinc-400",
                  )}
                >
                  {f.priority_score.toFixed(1)}
                </span>
              )}
            </button>
          ))}
          {stats.top_findings.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-zinc-600">
              Нет оценённых находок
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Enrichment Coverage ----------

interface CoverageBarProps {
  label: string;
  value: number;
  color: string;
}

function CoverageBar({ label, value, color }: CoverageBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function EnrichmentCoverageWidget({ stats }: { stats: DashboardStats }) {
  const c = stats.enrichment_coverage;
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-300">
          Покрытие обогащения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <CoverageBar label="NVD" value={c.nvd} color="bg-red-600" />
        <CoverageBar label="EPSS" value={c.epss} color="bg-blue-500" />
        <CoverageBar label="CISA KEV" value={c.kev} color="bg-red-500" />
        <CoverageBar label="БДУ ФСТЭК" value={c.bdu} color="bg-amber-500" />
      </CardContent>
    </Card>
  );
}

// ---------- Loading State ----------

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-zinc-800/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 bg-zinc-800/50" />
        <Skeleton className="h-40 bg-zinc-800/50" />
      </div>
      <Skeleton className="h-64 bg-zinc-800/50" />
    </div>
  );
}
