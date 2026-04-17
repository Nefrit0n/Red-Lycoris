import { Flame } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EnrichmentBadgesProps {
  inKev?: boolean;
  inBdu?: boolean;
  maxEpss?: number | null;
  maxCvss?: number | null;
  fixedVersion?: string | null;
  cweIds?: number[];
  className?: string;
  compact?: boolean;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function cvssClass(score: number): string {
  if (score >= 9) return "border-red-700/70 bg-red-950/70 text-red-200";
  if (score >= 7) return "border-orange-700/70 bg-orange-950/60 text-orange-200";
  if (score >= 4) return "border-yellow-700/70 bg-yellow-950/50 text-yellow-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function epssBarClass(value: number): string {
  return value >= 0.1 ? "bg-amber-500/70" : "bg-zinc-500/60";
}

export function EnrichmentBadges({
  inKev,
  inBdu,
  maxEpss,
  maxCvss,
  fixedVersion,
  cweIds,
  className,
}: EnrichmentBadgesProps) {
  const hasAny =
    inKev || inBdu || maxEpss != null || maxCvss != null || !!fixedVersion ||
    (cweIds?.length ?? 0) > 0;

  if (!hasAny) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  const primarySignal = inKev ? (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-red-700/70 bg-red-950/70 px-2 text-[11px] font-semibold uppercase tracking-wide text-red-200">
      <Flame className="size-3" />
      KEV
    </span>
  ) : maxCvss != null ? (
    <span className={cn("inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold", cvssClass(maxCvss))}>
      CVSS {maxCvss.toFixed(1)}
    </span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-400">
      CVSS —
    </span>
  );

  const secondaryTags = [
    inBdu ? "БДУ" : null,
    fixedVersion ? "Fix" : null,
    cweIds && cweIds.length > 0 ? `CWE-${cweIds[0]}` : null,
  ].filter(Boolean) as string[];

  const epssValue = maxEpss ?? 0;

  return (
    <div className={cn("flex h-7 w-[280px] items-center gap-2", className)}>
      <Tooltip
        content={
          inKev
            ? "В каталоге известных эксплуатируемых уязвимостей CISA (KEV)"
            : maxCvss != null
              ? `CVSS base score: ${maxCvss.toFixed(1)} из 10`
              : "CVSS не рассчитан"
        }
      >
        <div className="shrink-0">{primarySignal}</div>
      </Tooltip>

      <Tooltip content={`EPSS: ${formatPercent(epssValue)}`}>
        <div className="min-w-[86px] flex-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>EPSS</span>
            <span className={cn(epssValue >= 0.1 && "text-amber-300")}>{formatPercent(epssValue)}</span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-zinc-800">
            <span
              className={cn("block h-full rounded", epssBarClass(epssValue))}
              style={{ width: `${Math.max(4, Math.min(100, epssValue * 100))}%` }}
            />
          </div>
        </div>
      </Tooltip>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {secondaryTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-5 items-center rounded border border-zinc-700 px-1.5 text-[10px] text-zinc-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default EnrichmentBadges;
