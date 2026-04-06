import { cn } from "@/lib/utils";
import type { FindingScore } from "@/types";

function scoreColor(score: number): string {
  if (score >= 9) return "bg-red-500";
  if (score >= 7) return "bg-orange-500";
  if (score >= 5) return "bg-yellow-500";
  if (score >= 3) return "bg-blue-500";
  return "bg-emerald-500";
}

function scoreTextColor(score: number): string {
  if (score >= 9) return "text-red-400";
  if (score >= 7) return "text-orange-400";
  if (score >= 5) return "text-yellow-400";
  if (score >= 3) return "text-blue-400";
  return "text-emerald-400";
}

interface PriorityScoreProps {
  score: number;
  breakdown?: FindingScore | null;
  size?: "sm" | "lg";
}

export default function PriorityScore({
  score,
  breakdown,
  size = "sm",
}: PriorityScoreProps) {
  const pct = Math.min(score / 10, 1) * 100;

  return (
    <div className="group relative">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "font-mono font-bold",
            scoreTextColor(score),
            size === "lg" ? "text-2xl" : "text-sm",
          )}
        >
          {score.toFixed(1)}
        </span>
        <div
          className={cn(
            "flex-1 overflow-hidden rounded-full bg-zinc-800",
            size === "lg" ? "h-2.5" : "h-1.5",
          )}
        >
          <div
            className={cn("h-full rounded-full transition-all", scoreColor(score))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {breakdown && (
        <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl group-hover:block">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">CVSS Base</span>
              <span className="font-mono text-zinc-200">
                {breakdown.base_score.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">EPSS Score</span>
              <span className="font-mono text-zinc-200">
                {(breakdown.epss_score * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">EPSS Percentile</span>
              <span className="font-mono text-zinc-200">
                {(breakdown.epss_percentile * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">CISA KEV</span>
              <span
                className={
                  breakdown.is_kev ? "font-medium text-red-400" : "text-zinc-500"
                }
              >
                {breakdown.is_kev ? "Да" : "Нет"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">БДУ ФСТЭК</span>
              <span
                className={
                  breakdown.is_bdu ? "font-medium text-amber-400" : "text-zinc-500"
                }
              >
                {breakdown.is_bdu ? "Да" : "Нет"}
              </span>
            </div>
            <div className="mt-1 border-t border-zinc-700 pt-1">
              <div className="flex justify-between font-medium">
                <span className="text-zinc-300">Приоритет</span>
                <span className={cn("font-mono", scoreTextColor(breakdown.priority_score))}>
                  {breakdown.priority_score.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
