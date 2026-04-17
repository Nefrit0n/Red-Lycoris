import { useMemo } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import type { ColumnKey } from "@/components/findings/findingsTableConfig";
import { cn } from "@/lib/utils";

interface EnrichmentBadgesProps {
  inKev?: boolean;
  inBdu?: boolean;
  maxEpss?: number | null;
  maxCvss?: number | null;
  fixedVersion?: string | null;
  cweIds?: number[];
  activeColumns?: Set<ColumnKey>;
  className?: string;
}

type EnrichmentBadge = {
  key: string;
  label: string;
  tone: "bdu" | "fix" | "cwe" | "kev" | "cvss";
};

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

export function getEnrichmentBadges(input: {
  inKev?: boolean;
  inBdu?: boolean;
  maxCvss?: number | null;
  fixedVersion?: string | null;
  cweIds?: number[];
  activeColumns?: Set<ColumnKey>;
}): EnrichmentBadge[] {
  const { inKev, inBdu, maxCvss, fixedVersion, cweIds, activeColumns = new Set<ColumnKey>() } = input;
  const badges: EnrichmentBadge[] = [];

  if (inKev && !activeColumns.has("kev")) {
    badges.push({ key: "kev", label: "🔥 KEV", tone: "kev" });
  } else if (typeof maxCvss === "number") {
    badges.push({ key: "cvss", label: `CVSS ${maxCvss.toFixed(1)}`, tone: "cvss" });
  }

  if (inBdu && !activeColumns.has("bdu")) {
    badges.push({ key: "bdu", label: "БДУ", tone: "bdu" });
  }

  if (fixedVersion && !activeColumns.has("fix")) {
    badges.push({ key: "fix", label: `Fix ${fixedVersion}`, tone: "fix" });
  }

  if (cweIds && cweIds.length > 0 && !activeColumns.has("cwe")) {
    badges.push({ key: "cwe", label: `CWE-${cweIds[0]}`, tone: "cwe" });
  }

  return badges;
}

function badgeClass(tone: EnrichmentBadge["tone"]): string {
  switch (tone) {
    case "kev":
      return "border-red-600 bg-red-600 text-white";
    case "bdu":
      return "border-sky-500/70 text-sky-300";
    case "fix":
      return "border-emerald-500/70 text-emerald-300";
    case "cwe":
      return "border-zinc-600 text-zinc-300";
    case "cvss":
      return "border-zinc-600 text-zinc-300";
  }
}

export function EnrichmentBadges({
  inKev,
  inBdu,
  maxEpss,
  maxCvss,
  fixedVersion,
  cweIds,
  activeColumns,
  className,
}: EnrichmentBadgesProps) {
  const activeSet = activeColumns ?? new Set<ColumnKey>();
  const showEpss = typeof maxEpss === "number" && maxEpss > 0;
  const badges = useMemo(
    () => getEnrichmentBadges({ inKev, inBdu, maxCvss, fixedVersion, cweIds, activeColumns: activeSet }),
    [inKev, inBdu, maxCvss, fixedVersion, cweIds, activeSet],
  );

  const visibleBadges = badges.slice(0, 2);
  const hiddenBadges = badges.slice(2);

  return (
    <div className={cn("flex h-full w-full items-center gap-2 overflow-hidden", className)}>
      {visibleBadges.map((badge) => (
        <span
          key={badge.key}
          className={cn(
            "inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[11px] whitespace-nowrap",
            badgeClass(badge.tone),
          )}
        >
          {badge.tone === "cvss" ? (
            <span className={cn("inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-semibold", cvssClass(maxCvss ?? 0))}>
              {badge.label}
            </span>
          ) : (
            badge.label
          )}
        </span>
      ))}

      {hiddenBadges.length > 0 && (
        <Tooltip
          content={
            <div className="space-y-1">
              {hiddenBadges.map((badge) => (
                <div key={badge.key}>{badge.label}</div>
              ))}
            </div>
          }
          side="top"
          align="start"
        >
          <button
            type="button"
            className="inline-flex h-5 shrink-0 items-center rounded border border-zinc-600 px-1.5 text-[11px] text-zinc-300"
          >
            +{hiddenBadges.length}
          </button>
        </Tooltip>
      )}

      {showEpss && (
        <div className="ml-auto flex w-[110px] shrink-0 items-center justify-between gap-1.5 overflow-hidden">
          <span className="font-mono text-[11px] text-zinc-400">{(maxEpss * 100).toFixed(1)}%</span>
          <span className="h-1 w-[60px] overflow-hidden rounded bg-zinc-800">
            <span
              className={cn("block h-full rounded", epssColor(maxEpss))}
              style={{ width: `${epssLogWidth(maxEpss)}px` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export default EnrichmentBadges;
