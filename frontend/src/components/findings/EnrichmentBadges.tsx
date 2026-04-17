import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

interface EnrichmentBadgesProps {
  inKev?: boolean;
  inBdu?: boolean;
  maxEpss?: number | null;
  maxCvss?: number | null;
  fixedVersion?: string | null;
  cweIds?: number[];
  className?: string;
}

function cvssClass(score: number): string {
  if (score >= 9) return "border-red-600 bg-red-600 text-white";
  if (score >= 7) return "border-orange-500 bg-orange-500 text-zinc-950";
  if (score >= 4) return "border-yellow-500 bg-yellow-500 text-zinc-950";
  return "border-zinc-600 bg-zinc-700 text-zinc-100";
}

function epssColor(value: number): string {
  if (value > 0.1) return "bg-orange-500";
  if (value >= 0.01) return "bg-yellow-500";
  return "bg-zinc-500";
}

function epssLogWidth(value: number): number {
  if (value <= 0) return 0;
  const min = Math.log10(0.0001);
  const max = Math.log10(1);
  const normalized = (Math.log10(value) - min) / (max - min);
  return Math.max(6, Math.min(60, Math.round(normalized * 60)));
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
  const cwe = cweIds && cweIds.length > 0 ? `CWE-${cweIds[0]}` : null;
  const showEpss = typeof maxEpss === "number" && maxEpss > 0;
  const showPrimary = inKev || typeof maxCvss === "number";

  return (
    <div className={cn("flex h-[20px] w-[320px] items-center gap-2", className)}>
      {showPrimary && (
        <div className="w-[90px] shrink-0">
          {inKev ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-red-600 bg-red-600 px-2 text-[11px] font-semibold text-white">
              <Flame className="size-3" />
              KEV
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold",
                cvssClass(maxCvss ?? 0),
              )}
            >
              CVSS {(maxCvss ?? 0).toFixed(1)}
            </span>
          )}
        </div>
      )}

      {showEpss && (
        <div className="flex w-[110px] shrink-0 items-center justify-between gap-1.5">
          <span className="font-mono text-[11px] text-zinc-400">{(maxEpss! * 100).toFixed(1)}%</span>
          <span className="h-1 w-[60px] overflow-hidden rounded bg-zinc-800">
            <span
              className={cn("block h-full rounded", epssColor(maxEpss!))}
              style={{ width: `${epssLogWidth(maxEpss!)}px` }}
            />
          </span>
        </div>
      )}

      <div className="ml-auto flex min-w-0 items-center gap-1">
        {inBdu && (
          <span className="inline-flex h-5 items-center rounded border border-sky-500/70 px-1.5 text-[11px] text-sky-300">
            БДУ
          </span>
        )}
        {fixedVersion && (
          <span className="inline-flex h-5 items-center rounded border border-emerald-500/70 px-1.5 text-[11px] text-emerald-300">
            Fix {fixedVersion}
          </span>
        )}
        {cwe && (
          <span className="inline-flex h-5 items-center rounded border border-zinc-600 px-1.5 text-[11px] text-zinc-300">
            {cwe}
          </span>
        )}
      </div>
    </div>
  );
}

export default EnrichmentBadges;
