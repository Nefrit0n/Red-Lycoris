import { AlertTriangle, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFindingEnrichments } from "@/api/enrichment";
import type { FindingEnrichment } from "@/types";
import { cn } from "@/lib/utils";

function bySource(
  enrichments: FindingEnrichment[],
  source: string,
): FindingEnrichment | undefined {
  return enrichments.find((e) => e.source === source);
}

interface NvdData {
  cvss_v3_vector?: string;
  cvss_v3_score?: number;
  cvss_v2_score?: number;
  description?: string;
  published?: string;
  references?: { url: string; source: string }[];
}

function NvdSection({ data }: { data: NvdData }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-200">
          NVD / CVSS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data.cvss_v3_score != null && (
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">CVSS v3</span>
            <span
              className={cn(
                "font-mono font-bold",
                data.cvss_v3_score >= 9
                  ? "text-red-400"
                  : data.cvss_v3_score >= 7
                    ? "text-orange-400"
                    : "text-yellow-400",
              )}
            >
              {data.cvss_v3_score.toFixed(1)}
            </span>
          </div>
        )}
        {data.cvss_v3_vector && (
          <div>
            <span className="text-zinc-400">Vector: </span>
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
              {data.cvss_v3_vector}
            </code>
          </div>
        )}
        {data.description && (
          <p className="leading-relaxed text-zinc-400">{data.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface EpssData {
  score?: number;
  percentile?: number;
  date?: string;
}

function EpssSection({ data }: { data: EpssData }) {
  const scorePct = (data.score ?? 0) * 100;
  const percentile = (data.percentile ?? 0) * 100;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-200">
          EPSS — Exploit Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-zinc-500">Probability</div>
            <div className="font-mono text-lg font-bold text-zinc-200">
              {scorePct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Percentile</div>
            <div className="font-mono text-lg font-bold text-zinc-200">
              {percentile.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${Math.min(percentile, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface KevData {
  date_added?: string;
  due_date?: string;
  known_ransomware_campaign_use?: string;
  notes?: string;
  vulnerability_name?: string;
}

function KevSection({ data }: { data: KevData }) {
  return (
    <Card className="border-red-800/50 bg-red-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-red-400">
          <AlertTriangle className="size-4" />
          CISA KEV — Actively Exploited
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.vulnerability_name && (
          <p className="text-zinc-300">{data.vulnerability_name}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {data.date_added && (
            <>
              <span className="text-zinc-500">Added</span>
              <span className="text-zinc-300">{data.date_added}</span>
            </>
          )}
          {data.due_date && (
            <>
              <span className="text-zinc-500">Due date</span>
              <span className="font-medium text-red-400">{data.due_date}</span>
            </>
          )}
        </div>
        {data.known_ransomware_campaign_use === "Known" && (
          <Badge variant="destructive" className="mt-1">
            Ransomware associated
          </Badge>
        )}
        {data.notes && (
          <p className="text-xs leading-relaxed text-zinc-500">{data.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface BduData {
  identifier?: string;
  name?: string;
  description?: string;
  remediation?: string;
  severity?: string;
}

function BduSection({ data }: { data: BduData }) {
  return (
    <Card className="border-amber-800/40 bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-amber-400">
          BDU FSTEC
          {data.identifier && (
            <span className="ml-2 font-mono text-xs text-amber-500">
              {data.identifier}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.description && (
          <p className="leading-relaxed text-zinc-400">{data.description}</p>
        )}
        {data.remediation && (
          <div>
            <span className="text-xs font-medium text-zinc-500">
              Remediation
            </span>
            <p className="mt-0.5 leading-relaxed text-zinc-400">
              {data.remediation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface OsvData {
  id?: string;
  summary?: string;
  affected?: { package?: { name?: string; ecosystem?: string }; ranges?: { events?: { fixed?: string; introduced?: string }[] }[] }[];
}

function OsvSection({ data }: { data: OsvData }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          OSV
          {data.id && (
            <a
              href={`https://osv.dev/vulnerability/${data.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400 hover:underline"
            >
              {data.id}
              <ExternalLink className="ml-1 inline size-3" />
            </a>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.summary && <p className="text-zinc-400">{data.summary}</p>}
        {data.affected?.map((a, i) => (
          <div key={i} className="rounded bg-zinc-800/50 p-2">
            <span className="font-mono text-xs text-zinc-300">
              {a.package?.ecosystem}/{a.package?.name}
            </span>
            {a.ranges?.map((r, ri) =>
              r.events?.map((e, ei) =>
                e.fixed ? (
                  <div key={`${ri}-${ei}`} className="mt-1 text-xs">
                    <span className="text-zinc-500">Fixed in </span>
                    <span className="font-mono text-emerald-400">{e.fixed}</span>
                  </div>
                ) : null,
              ),
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EnrichmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full bg-zinc-800/50" />
      <Skeleton className="h-24 w-full bg-zinc-800/50" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
      No {label} data available
    </div>
  );
}

interface EnrichmentTabsProps {
  findingId: string;
}

export default function EnrichmentTabs({ findingId }: EnrichmentTabsProps) {
  const { data, isLoading } = useFindingEnrichments(findingId);
  const enrichments = data?.data ?? [];

  if (isLoading) return <EnrichmentSkeleton />;

  const nvd = bySource(enrichments, "nvd");
  const epss = bySource(enrichments, "epss");
  const kev = bySource(enrichments, "kev");
  const bdu = bySource(enrichments, "bdu");
  const osv = bySource(enrichments, "osv");

  return (
    <div className="space-y-4">
      {kev ? (
        <KevSection data={kev.data as KevData} />
      ) : null}
      {nvd ? (
        <NvdSection data={nvd.data as NvdData} />
      ) : (
        <EmptyState label="NVD" />
      )}
      {epss ? (
        <EpssSection data={epss.data as EpssData} />
      ) : (
        <EmptyState label="EPSS" />
      )}
      {bdu ? <BduSection data={bdu.data as BduData} /> : null}
      {osv ? <OsvSection data={osv.data as OsvData} /> : null}
    </div>
  );
}
