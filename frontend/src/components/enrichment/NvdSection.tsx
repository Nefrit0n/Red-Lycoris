import {
  Calendar,
  ExternalLink,
  FileText,
  Flame,
  Info,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CVSS31_METRICS,
  CVSS40_METRICS,
  CVSS_V2_METRICS,
  type MetricMeta,
  SEVERITY_CLASSES,
  severityFromScore,
} from "./cvss-metrics";

interface CvssMetricsV31 {
  AV?: string; AC?: string; PR?: string; UI?: string; S?: string; C?: string; I?: string; A?: string;
}
interface CvssMetricsV40 {
  AV?: string; AC?: string; AT?: string; PR?: string; UI?: string;
  VC?: string; VI?: string; VA?: string; SC?: string; SI?: string; SA?: string;
}
interface CvssMetricsV2 {
  AV?: string; AC?: string; Au?: string; C?: string; I?: string; A?: string;
}

interface NvdRef {
  url: string;
  source?: string;
  tags?: string[];
}

export type RefCategory =
  | "patch"
  | "exploit"
  | "mitigation"
  | "advisory_vendor"
  | "advisory_third_party"
  | "report"
  | "other";

interface CPEMatchInfo {
  criteria: string;
  vulnerable: boolean;
  version_start_including?: string;
  version_start_excluding?: string;
  version_end_including?: string;
  version_end_excluding?: string;
  reason: string;
}

interface CPEVerdictData {
  verdict: "affected" | "not_affected" | "unknown";
  matched?: CPEMatchInfo[];
  reason_summary: string;
}

export interface NvdEntry {
  cve_id: string;
  description?: string;
  cvss_v31?: { score?: number; vector?: string; metrics?: CvssMetricsV31 };
  cvss_v40?: { score?: number; vector?: string; metrics?: CvssMetricsV40 };
  cvss_v2?: { score?: number; vector?: string; metrics?: CvssMetricsV2 };
  cwe_ids?: number[];
  cpe_matches?: unknown;
  cpe_match?: CPEVerdictData;
  references?: Partial<Record<RefCategory, NvdRef[]>>;
  published_at?: string;
  modified_at?: string;
}

const REF_ORDER: RefCategory[] = [
  "patch",
  "exploit",
  "mitigation",
  "advisory_vendor",
  "advisory_third_party",
  "report",
  "other",
];

const REF_META: Record<
  RefCategory,
  { title: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  patch: { title: "Патчи", icon: Wrench, className: "border-emerald-800/50 bg-emerald-950/20 text-emerald-200" },
  exploit: { title: "Эксплойты", icon: Flame, className: "border-red-800/50 bg-red-950/20 text-red-200" },
  mitigation: { title: "Митигации", icon: ShieldCheck, className: "border-amber-800/50 bg-amber-950/20 text-amber-200" },
  advisory_vendor: { title: "Vendor advisory", icon: FileText, className: "border-blue-800/50 bg-blue-950/20 text-blue-200" },
  advisory_third_party: { title: "Third-party advisory", icon: FileText, className: "border-zinc-800 bg-zinc-900/50 text-zinc-200" },
  report: { title: "Отчёты", icon: Info, className: "border-zinc-800 bg-zinc-900/50 text-zinc-200" },
  other: { title: "Прочее", icon: FileText, className: "border-zinc-800 bg-zinc-900/50 text-zinc-200" },
};

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

function CvssBreakdown({
  label,
  block,
  dictionary,
  order,
}: {
  label: string;
  block: { vector?: string; metrics?: Record<string, string> | undefined };
  dictionary: Record<string, MetricMeta>;
  order: string[];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-zinc-100">{label}</h4>
        {block.vector && <code className="text-xs text-zinc-500">{block.vector}</code>}
      </div>
      {block.metrics && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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

function formatVersionRange(m: CPEMatchInfo): string {
  const start = m.version_start_including ?? m.version_start_excluding ?? "−∞";
  const end = m.version_end_including ?? m.version_end_excluding ?? "+∞";
  const left = m.version_start_including ? "[" : "(";
  const right = m.version_end_including ? "]" : ")";
  return `${left}${start}, ${end}${right}`;
}

function CpeVerdictBlock({ verdict }: { verdict: CPEVerdictData }) {
  const badgeClass = verdict.verdict === "affected"
    ? "border-red-700/60 bg-red-950/60 text-red-300"
    : verdict.verdict === "not_affected"
      ? "border-emerald-700/60 bg-emerald-950/60 text-emerald-300"
      : "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  const label = verdict.verdict === "affected"
    ? "Затронуто"
    : verdict.verdict === "not_affected"
      ? "Не затронуто"
      : "Не удалось определить";

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={badgeClass}>{label}</Badge>
        <span className="text-sm text-zinc-300">{verdict.reason_summary}</span>
      </div>
      {verdict.matched && verdict.matched.length > 0 && (
        <ul className="space-y-2">
          {verdict.matched.map((m, idx) => (
            <li key={`${m.criteria}-${idx}`} className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-xs">
              <code className="block break-all text-zinc-300">{m.criteria}</code>
              <div className="mt-1 font-mono text-zinc-400">{formatVersionRange(m)}</div>
              <p className="mt-1 text-zinc-500">{m.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferencesBlock({ refs }: { refs: Partial<Record<RefCategory, NvdRef[]>> }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-200">Ссылки</h4>
      <div className="space-y-2">
        {REF_ORDER.map((cat) => {
          const items = refs[cat] ?? [];
          if (items.length === 0) return null;
          const meta = REF_META[cat];
          const Icon = meta.icon;
          return (
            <div key={cat} className={cn("rounded-lg border p-3", meta.className)}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" />
                <span>{meta.title}</span>
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </div>
              <ul className="space-y-1">
                {items.map((item, idx) => (
                  <li key={`${item.url}-${idx}`} className="flex items-start justify-between gap-2 text-xs">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all text-red-300 hover:underline">
                      {item.url}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    {item.source && <span className="shrink-0 font-mono text-[10px] text-zinc-500">{item.source}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DatesRow({ publishedAt, modifiedAt }: { publishedAt?: string; modifiedAt?: string }) {
  if (!publishedAt && !modifiedAt) return null;

  const formatDate = (value: string) => format(new Date(value), "d MMM yyyy", { locale: ru });

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
      {publishedAt && (
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3" />
          Опубликована: {formatDate(publishedAt)}
        </span>
      )}
      {modifiedAt && (
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3" />
          Изменена: {formatDate(modifiedAt)}
        </span>
      )}
    </div>
  );
}

function NvdEntryCard({ entry }: { entry: NvdEntry }) {
  const primaryScore = entry.cvss_v40?.score ?? entry.cvss_v31?.score ?? entry.cvss_v2?.score ?? null;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            <a
              href={`https://nvd.nist.gov/vuln/detail/${entry.cve_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-red-300 hover:underline"
            >
              {entry.cve_id}
              <ExternalLink className="size-3.5" />
            </a>
          </CardTitle>
          <ScoreBadge score={primaryScore} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entry.description && <p className="text-sm text-zinc-300">{entry.description}</p>}

        {entry.cvss_v40 && (
          <CvssBreakdown
            label="CVSS 4.0"
            block={{
              vector: entry.cvss_v40.vector,
              metrics: entry.cvss_v40.metrics as Record<string, string> | undefined,
            }}
            dictionary={CVSS40_METRICS}
            order={["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"]}
          />
        )}

        {entry.cvss_v31 && (
          <CvssBreakdown
            label="CVSS 3.1"
            block={{
              vector: entry.cvss_v31.vector,
              metrics: entry.cvss_v31.metrics as Record<string, string> | undefined,
            }}
            dictionary={CVSS31_METRICS}
            order={["AV", "AC", "PR", "UI", "S", "C", "I", "A"]}
          />
        )}

        {!entry.cvss_v40 && !entry.cvss_v31 && entry.cvss_v2 && (
          <CvssBreakdown
            label="CVSS 2.0"
            block={{
              vector: entry.cvss_v2.vector,
              metrics: entry.cvss_v2.metrics as Record<string, string> | undefined,
            }}
            dictionary={CVSS_V2_METRICS}
            order={["AV", "AC", "Au", "C", "I", "A"]}
          />
        )}

        {entry.references && <ReferencesBlock refs={entry.references} />}
        {entry.cpe_match && <CpeVerdictBlock verdict={entry.cpe_match} />}

        {entry.cpe_matches != null && (
          <details className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <summary className="cursor-pointer text-xs text-zinc-400">Raw CPE configurations (debug)</summary>
            <pre className="mt-2 overflow-auto text-xs text-zinc-500">{JSON.stringify(entry.cpe_matches as object, null, 2)}</pre>
          </details>
        )}

        <DatesRow publishedAt={entry.published_at} modifiedAt={entry.modified_at} />
      </CardContent>
    </Card>
  );
}

export default function NvdSection({ entries }: { entries: NvdEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Нет данных от NVD для этой находки.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <NvdEntryCard key={entry.cve_id} entry={entry} />
      ))}
    </div>
  );
}
