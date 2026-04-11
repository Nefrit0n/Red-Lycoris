import { Flame, ShieldAlert, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EnrichmentBadgesProps {
  inKev?: boolean;
  inBdu?: boolean;
  maxEpss?: number | null;
  maxCvss?: number | null;
  fixedVersion?: string | null;
  className?: string;
  compact?: boolean;
}

// Mix two HSL-ish points along a simple green→yellow→red gradient. t is
// clamped to 0..1. The returned color is a `hsl(...)` string ready for
// inline styling; we keep the saturation/lightness flat so adjacent badges
// don't visually fight each other.
function gradient(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // 120° = green, 60° = yellow, 0° = red. Walk the wheel linearly.
  const hue = 120 * (1 - clamped);
  return `hsl(${hue.toFixed(0)} 70% 35%)`;
}

function textOn(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const hue = 120 * (1 - clamped);
  return `hsl(${hue.toFixed(0)} 80% 85%)`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function EnrichmentBadges({
  inKev,
  inBdu,
  maxEpss,
  maxCvss,
  fixedVersion,
  className,
  compact,
}: EnrichmentBadgesProps) {
  const hasAny =
    inKev || inBdu || maxEpss != null || maxCvss != null || !!fixedVersion;
  if (!hasAny) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {inKev && (
        <Tooltip content="В каталоге известных эксплуатируемых уязвимостей CISA (KEV)">
          <Badge
            variant="destructive"
            className="gap-1 border-red-700/60 bg-red-950/60 text-red-300"
          >
            <Flame className="size-3" />
            KEV
          </Badge>
        </Tooltip>
      )}

      {maxEpss != null && (
        <Tooltip
          content={
            <span>
              EPSS — вероятность эксплуатации в&nbsp;ближайшие 30&nbsp;дней:{" "}
              <b>{formatPercent(maxEpss)}</b>
            </span>
          }
        >
          <Badge
            className="gap-1 border border-transparent"
            style={{
              backgroundColor: gradient(maxEpss),
              color: textOn(maxEpss),
            }}
          >
            EPSS {maxEpss.toFixed(2)}
          </Badge>
        </Tooltip>
      )}

      {maxCvss != null && (
        <Tooltip
          content={
            <span>
              CVSS base score: <b>{maxCvss.toFixed(1)}</b> из&nbsp;10
            </span>
          }
        >
          <Badge
            className="gap-1 border border-transparent"
            style={{
              backgroundColor: gradient(maxCvss / 10),
              color: textOn(maxCvss / 10),
            }}
          >
            CVSS {maxCvss.toFixed(1)}
          </Badge>
        </Tooltip>
      )}

      {inBdu && (
        <Tooltip content="В базе БДУ ФСТЭК России">
          <Badge className="gap-1 border-blue-700/60 bg-blue-950/60 text-blue-300">
            <ShieldAlert className="size-3" />
            БДУ
          </Badge>
        </Tooltip>
      )}

      {fixedVersion && (
        <Tooltip
          content={
            <span>
              Уязвимость исправлена в&nbsp;версии{" "}
              <b className="font-mono">{fixedVersion}</b>
            </span>
          }
        >
          <Badge className="gap-1 border-emerald-700/60 bg-emerald-950/60 text-emerald-300">
            <Wrench className="size-3" />
            {compact ? "Fix" : `Fix ${fixedVersion}`}
          </Badge>
        </Tooltip>
      )}
    </div>
  );
}

export default EnrichmentBadges;
