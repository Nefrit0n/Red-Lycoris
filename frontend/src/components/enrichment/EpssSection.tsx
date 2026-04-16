import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  Minus,
  TrendingDown,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASSES, type Severity } from "./cvss-metrics";

export interface EpssEntry {
  cve_id: string;
  epss_score: number;
  percentile: number;
  score_date: string;
  tier: "minimal" | "low" | "moderate" | "elevated" | "critical";
  trend_7d: number;
  trend_30d: number;
  peak_90d: number;
  is_rising: boolean;
  history?: Array<{ date: string; score: number; percentile: number }>;
}

const TIER_SEVERITY: Record<EpssEntry["tier"], Severity> = {
  critical: "critical",
  elevated: "high",
  moderate: "medium",
  low: "low",
  minimal: "neutral",
};

const TIER_LABEL: Record<EpssEntry["tier"], string> = {
  critical: "Critical",
  elevated: "Elevated",
  moderate: "Moderate",
  low: "Low",
  minimal: "Minimal",
};

function trendColor(value: number): string {
  if (value > 0.05) return "text-red-300";
  if (value < -0.05) return "text-emerald-300";
  return "text-zinc-400";
}

function trendIcon(value: number) {
  if (value > 0.05) return TrendingUp;
  if (value < -0.05) return TrendingDown;
  return Minus;
}

function formatTrend(value: number): string {
  const points = value * 100;
  if (points > 0) return `+${points.toFixed(1)}%`;
  return `${points.toFixed(1)}%`;
}

function Sparkline({
  points,
  tier,
}: {
  points: Array<{ date: string; score: number }>;
  tier: EpssEntry["tier"];
}) {
  if (points.length < 2) {
    return <div className="text-xs text-zinc-600">Недостаточно данных для графика</div>;
  }

  const W = 280;
  const H = 60;
  const pad = 4;

  const minScore = Math.min(...points.map((p) => p.score));
  const maxScore = Math.max(...points.map((p) => p.score));
  const range = maxScore - minScore || 0.01;

  const coords = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (W - 2 * pad);
      const y = pad + (1 - (p.score - minScore) / range) * (H - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");

  const last = points[points.length - 1];
  const lastX = pad + (W - 2 * pad);
  const lastY = pad + (1 - (last.score - minScore) / range) * (H - 2 * pad);

  const strokeColor = {
    critical: "#f87171",
    elevated: "#fb923c",
    moderate: "#fbbf24",
    low: "#4ade80",
    minimal: "#71717a",
  }[tier];

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
      <circle cx={lastX} cy={lastY} r="3" fill={strokeColor} />
    </svg>
  );
}

function EpssEntryCard({ entry }: { entry: EpssEntry }) {
  const scoreText = `${(entry.epss_score * 100).toFixed(2)}%`;
  const percentileText =
    entry.percentile >= 0.99
      ? `опаснее ${(entry.percentile * 100).toFixed(1)}% всех CVE — топ-1%`
      : `опаснее ${(entry.percentile * 100).toFixed(1)}% всех известных CVE`;

  const Trend7Icon = trendIcon(entry.trend_7d);
  const Trend30Icon = trendIcon(entry.trend_30d);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-base">
            <a
              href={`https://www.first.org/epss/data_stats#${entry.cve_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-red-300 hover:underline"
            >
              {entry.cve_id}
              <ExternalLink className="size-3.5" />
            </a>
          </CardTitle>

          <div className="flex items-center gap-2">
            <Tooltip
              content="EPSS (Exploit Prediction Scoring System) — вероятность эксплуатации этой уязвимости в ближайшие 30 дней, по модели FIRST.org"
            >
              <Badge
                className={cn(
                  "inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm",
                  SEVERITY_CLASSES[TIER_SEVERITY[entry.tier]],
                )}
              >
                <TrendingUp className="size-3.5" />
                Tier: {TIER_LABEL[entry.tier]}
              </Badge>
            </Tooltip>
            <div className="text-right text-xl font-semibold text-zinc-100">{scoreText}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <p className="text-sm text-zinc-300">Перцентиль: ваша CVE {percentileText}</p>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-red-500/80"
                style={{ width: `${Math.min(100, entry.percentile * 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-zinc-400">
              {(entry.percentile * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <Sparkline
            points={(entry.history ?? []).map((p) => ({ date: p.date, score: p.score }))}
            tier={entry.tier}
          />

          <div className="space-y-1.5 text-xs">
            <div className={cn("inline-flex items-center gap-1.5", trendColor(entry.trend_7d))}>
              <Trend7Icon className="size-3.5" />
              <span>7d {formatTrend(entry.trend_7d)}</span>
            </div>
            <div className={cn("inline-flex items-center gap-1.5", trendColor(entry.trend_30d))}>
              <Trend30Icon className="size-3.5" />
              <span>30d {formatTrend(entry.trend_30d)}</span>
            </div>
            <div className="text-zinc-400">peak {(entry.peak_90d * 100).toFixed(1)}%</div>
          </div>
        </div>

        {entry.is_rising && (
          <div className="flex items-center gap-2 rounded-md border border-red-700/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="size-4" />
            Резкий рост эксплуатируемости: +{(entry.trend_7d * 100).toFixed(1)}% за 7 дней
          </div>
        )}

        <p className="text-xs text-zinc-500">
          Обновлено: {format(new Date(entry.score_date), "d MMM yyyy", { locale: ru })}
        </p>
      </CardContent>
    </Card>
  );
}

export default function EpssSection({ entries }: { entries: EpssEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-600">
        Нет данных EPSS для этой находки
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <EpssEntryCard key={`${entry.cve_id}-${entry.score_date}`} entry={entry} />
      ))}
    </div>
  );
}
