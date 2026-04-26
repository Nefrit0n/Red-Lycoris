import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SEVERITY_CLASSES,
  severityFromScore,
  type MetricMeta,
} from "./cvss-metrics";

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const severity = severityFromScore(score);
  return (
    <Badge className={cn("text-base font-semibold", SEVERITY_CLASSES[severity])}>
      {score.toFixed(1)}
    </Badge>
  );
}

function MetricBadge({ metricKey, value, dictionary }: { metricKey: string; value: string; dictionary: Record<string, MetricMeta> }) {
  const metric = dictionary[metricKey];
  const meta = metric?.values[value];
  const severity = meta?.severity ?? "neutral";

  return (
    <Tooltip
      content={
        <div className="max-w-xs space-y-1 text-xs">
          <p className="font-medium text-zinc-100">{metric?.label ?? metricKey}</p>
          <p>{metric?.description ?? ""}</p>
          <p className="text-zinc-400">{meta?.hint ?? `Значение: ${value}`}</p>
        </div>
      }
    >
      <div className={cn("rounded-md border px-2 py-1 text-xs", SEVERITY_CLASSES[severity])}>
        <div className="text-zinc-200">{metric?.label ?? metricKey}</div>
        <div className="font-mono text-[11px]">{meta?.label ?? value}</div>
      </div>
    </Tooltip>
  );
}

interface CvssBreakdownProps {
  label: string;
  block: {
    score?: number;
    vector?: string;
    metrics?: Record<string, string | undefined>;
  };
  dictionary: Record<string, MetricMeta>;
  order: string[];
  compact?: boolean;
}

export default function CvssBreakdown({ label, block, dictionary, order, compact = false }: CvssBreakdownProps) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={cn("font-medium text-zinc-100", compact ? "text-xs" : "text-sm")}>{label}</h4>
        <div className="flex items-center gap-2">
          <ScoreBadge score={block.score ?? null} />
        </div>
      </div>
      {block.vector && (
        <code
          className={cn(
            "block w-full overflow-x-auto rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1 font-mono text-zinc-400",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {block.vector}
        </code>
      )}
      {block.metrics && (
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
          {order.map((key) => {
            const value = block.metrics?.[key];
            if (!value) return null;
            return (
              <MetricBadge
                key={key}
                metricKey={key}
                value={value}
                dictionary={dictionary}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
