import { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Shield,
  TrendingUp,
  Bug,
  Package,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useFindingEnrichments, useTriggerSync } from "@/api/enrichment";
import type { FindingEnrichment } from "@/types";
import { cn } from "@/lib/utils";

function bySource(
  enrichments: FindingEnrichment[],
  source: string,
): FindingEnrichment | undefined {
  return enrichments.find((e) => e.source === source);
}

/* ── NVD ────────────────────────────────────────────────── */

interface NvdData {
  cvss_v3_vector?: string;
  cvss_v3_score?: number;
  cvss_v2_score?: number;
  description?: string;
  published?: string;
  references?: { url: string; source: string }[];
}

function CvssGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const radius = 40;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color =
    score >= 9
      ? "text-red-500"
      : score >= 7
        ? "text-orange-500"
        : score >= 4
          ? "text-yellow-500"
          : "text-emerald-500";

  const label =
    score >= 9
      ? "Критический"
      : score >= 7
        ? "Высокий"
        : score >= 4
          ? "Средний"
          : "Низкий";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-zinc-800"
        />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
        <text
          x="50"
          y="48"
          textAnchor="middle"
          className={cn("fill-current text-lg font-bold", color)}
          fontSize="18"
        >
          {score.toFixed(1)}
        </text>
      </svg>
      <span className={cn("text-xs font-medium", color)}>{label}</span>
    </div>
  );
}

function NvdSection({ data }: { data: NvdData }) {
  return (
    <div className="space-y-4">
      {data.cvss_v3_score != null && (
        <div className="flex items-start gap-6">
          <CvssGauge score={data.cvss_v3_score} />
          <div className="flex-1 space-y-2">
            {data.cvss_v3_vector && (
              <div>
                <span className="text-xs text-zinc-500">Vector String</span>
                <code className="mt-0.5 block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  {data.cvss_v3_vector}
                </code>
              </div>
            )}
            {data.published && (
              <div>
                <span className="text-xs text-zinc-500">Опубликовано</span>
                <p className="text-sm text-zinc-300">{data.published}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {data.cvss_v2_score != null && !data.cvss_v3_score && (
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">CVSS v2</span>
          <span className="font-mono font-bold text-yellow-400">
            {data.cvss_v2_score.toFixed(1)}
          </span>
        </div>
      )}
      {data.description && (
        <div>
          <span className="text-xs text-zinc-500">Описание</span>
          <p className="mt-1 leading-relaxed text-zinc-400">
            {data.description}
          </p>
        </div>
      )}
      {data.references && data.references.length > 0 && (
        <div>
          <span className="text-xs text-zinc-500">Ссылки</span>
          <ul className="mt-1 space-y-1">
            {data.references.map((ref, i) => (
              <li key={i}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
                >
                  {ref.source || ref.url}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── EPSS ───────────────────────────────────────────────── */

interface EpssData {
  score?: number;
  percentile?: number;
  date?: string;
}

function EpssGauge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80
      ? "bg-red-500"
      : value >= 50
        ? "bg-orange-500"
        : value >= 20
          ? "bg-yellow-500"
          : "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="font-mono text-sm font-bold text-zinc-200">
          {value.toFixed(2)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function EpssSection({ data }: { data: EpssData }) {
  const scorePct = (data.score ?? 0) * 100;
  const percentile = (data.percentile ?? 0) * 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-800/30">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100">
                {scorePct.toFixed(2)}%
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Вероятность эксплуатации
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-800/30">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100">
                {percentile.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs text-zinc-500">Перцентиль</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <EpssGauge value={scorePct} label="Вероятность эксплуатации (EPSS)" />
      <EpssGauge value={percentile} label="Перцентиль" />
      {data.date && (
        <p className="text-xs text-zinc-500">Данные от {data.date}</p>
      )}
    </div>
  );
}

/* ── KEV ────────────────────────────────────────────────── */

interface KevData {
  date_added?: string;
  due_date?: string;
  known_ransomware_campaign_use?: string;
  notes?: string;
  vulnerability_name?: string;
}

function KevSection({ data }: { data: KevData }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3">
        <AlertTriangle className="size-5 shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-400">
            ⚠️ Активно эксплуатируемая уязвимость
          </p>
          <p className="text-xs text-red-400/70">
            Включена в каталог CISA Known Exploited Vulnerabilities
          </p>
        </div>
      </div>

      {data.vulnerability_name && (
        <p className="text-sm text-zinc-300">{data.vulnerability_name}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {data.date_added && (
          <div>
            <span className="text-xs text-zinc-500">Дата добавления</span>
            <p className="text-zinc-300">{data.date_added}</p>
          </div>
        )}
        {data.due_date && (
          <div>
            <span className="text-xs text-zinc-500">Срок устранения</span>
            <p className="font-medium text-red-400">{data.due_date}</p>
          </div>
        )}
      </div>

      {data.known_ransomware_campaign_use === "Known" && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="size-3" />
          Используется в ransomware-кампаниях
        </Badge>
      )}

      {data.notes && (
        <div>
          <span className="text-xs text-zinc-500">Примечания</span>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {data.notes}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── БДУ ────────────────────────────────────────────────── */

interface BduData {
  identifier?: string;
  name?: string;
  description?: string;
  remediation?: string;
  severity?: string;
}

function BduSection({ data }: { data: BduData }) {
  const severityColor =
    data.severity === "Критический"
      ? "text-red-400 border-red-800 bg-red-950/30"
      : data.severity === "Высокий"
        ? "text-orange-400 border-orange-800 bg-orange-950/30"
        : data.severity === "Средний"
          ? "text-yellow-400 border-yellow-800 bg-yellow-950/30"
          : "text-emerald-400 border-emerald-800 bg-emerald-950/30";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {data.identifier && (
          <Badge className="border-amber-800 bg-amber-950/50 font-mono text-amber-400">
            {data.identifier}
          </Badge>
        )}
        {data.severity && (
          <Badge className={severityColor}>{data.severity}</Badge>
        )}
      </div>

      {data.name && (
        <div>
          <span className="text-xs text-zinc-500">Наименование</span>
          <p className="mt-0.5 text-sm text-zinc-300">{data.name}</p>
        </div>
      )}

      {data.description && (
        <div>
          <span className="text-xs text-zinc-500">Описание</span>
          <p className="mt-0.5 leading-relaxed text-zinc-400">
            {data.description}
          </p>
        </div>
      )}

      {data.remediation && (
        <div>
          <span className="text-xs text-zinc-500">Рекомендации</span>
          <p className="mt-0.5 leading-relaxed text-zinc-400">
            {data.remediation}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── OSV ────────────────────────────────────────────────── */

interface OsvData {
  id?: string;
  summary?: string;
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: {
      events?: { fixed?: string; introduced?: string }[];
    }[];
  }[];
}

function OsvSection({ data }: { data: OsvData }) {
  return (
    <div className="space-y-4">
      {data.id && (
        <a
          href={`https://osv.dev/vulnerability/${data.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-sm text-red-400 hover:underline"
        >
          {data.id}
          <ExternalLink className="size-3" />
        </a>
      )}

      {data.summary && (
        <p className="text-sm leading-relaxed text-zinc-400">{data.summary}</p>
      )}

      {data.affected && data.affected.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-zinc-500">Затронутые пакеты</span>
          {data.affected.map((a, i) => {
            const introduced = a.ranges
              ?.flatMap((r) => r.events ?? [])
              .filter((e) => e.introduced)
              .map((e) => e.introduced);
            const fixed = a.ranges
              ?.flatMap((r) => r.events ?? [])
              .filter((e) => e.fixed)
              .map((e) => e.fixed);

            return (
              <div key={i} className="rounded-md bg-zinc-800/50 p-3">
                <div className="flex items-center gap-2">
                  {a.package?.ecosystem && (
                    <Badge className="border-zinc-700 bg-zinc-800 text-zinc-400">
                      {a.package.ecosystem}
                    </Badge>
                  )}
                  <span className="font-mono text-sm text-zinc-300">
                    {a.package?.name}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  {introduced && introduced.length > 0 && (
                    <div>
                      <span className="text-zinc-500">Введено: </span>
                      <span className="font-mono text-red-400">
                        {introduced.join(", ")}
                      </span>
                    </div>
                  )}
                  {fixed && fixed.length > 0 && (
                    <div>
                      <span className="text-zinc-500">Исправлено: </span>
                      <span className="font-mono text-emerald-400">
                        {fixed.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── CWE ────────────────────────────────────────────────── */

interface CweData {
  id?: number;
  name?: string;
  description?: string;
  extended_description?: string;
  mitigations?: { phase?: string; description?: string }[];
}

function Collapsible({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-400 hover:text-zinc-200"
      >
        {title}
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>
      {open && <div className="border-t border-zinc-800 px-3 py-2">{children}</div>}
    </div>
  );
}

function CweSection({ data }: { data: CweData }) {
  return (
    <div className="space-y-4">
      {data.id && (
        <a
          href={`https://cwe.mitre.org/data/definitions/${data.id}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-sm text-blue-400 hover:underline"
        >
          CWE-{data.id}
          <ExternalLink className="size-3" />
        </a>
      )}

      {data.name && (
        <div>
          <span className="text-xs text-zinc-500">Наименование</span>
          <p className="mt-0.5 text-sm font-medium text-zinc-200">
            {data.name}
          </p>
        </div>
      )}

      {data.description && (
        <div>
          <span className="text-xs text-zinc-500">Описание</span>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">
            {data.description}
          </p>
        </div>
      )}

      {data.mitigations && data.mitigations.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-zinc-500">Меры по устранению</span>
          {data.mitigations.map((m, i) => (
            <Collapsible
              key={i}
              title={m.phase ?? `Мера ${i + 1}`}
            >
              <p className="text-xs leading-relaxed text-zinc-400">
                {m.description}
              </p>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared ─────────────────────────────────────────────── */

function EnrichmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full bg-zinc-800/50" />
      <Skeleton className="h-32 w-full bg-zinc-800/50" />
    </div>
  );
}

function EmptyState({
  label,
  findingId,
}: {
  label: string;
  findingId: string;
}) {
  const triggerSync = useTriggerSync();
  const sourceKey = label.toLowerCase();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 py-8 text-sm text-zinc-600">
      <p>Нет данных из {label}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => triggerSync.mutate(sourceKey)}
        disabled={triggerSync.isPending}
        className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
      >
        {triggerSync.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Обогатить сейчас
      </Button>
    </div>
  );
}

/* ── Tab config ─────────────────────────────────────────── */

interface TabMeta {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabMeta[] = [
  { key: "nvd", label: "NVD", icon: Shield },
  { key: "epss", label: "EPSS", icon: TrendingUp },
  { key: "kev", label: "KEV", icon: AlertTriangle },
  { key: "bdu", label: "БДУ", icon: Bug },
  { key: "osv", label: "OSV", icon: Package },
  { key: "cwe", label: "CWE", icon: BookOpen },
];

/* ── Main component ─────────────────────────────────────── */

interface EnrichmentTabsProps {
  findingId: string;
}

export default function EnrichmentTabs({ findingId }: EnrichmentTabsProps) {
  const { data, isLoading } = useFindingEnrichments(findingId);
  const enrichments = data?.data ?? [];

  if (isLoading) return <EnrichmentSkeleton />;

  const enrichmentMap = new Map(enrichments.map((e) => [e.source, e]));

  // Determine default tab: first available enrichment, or "nvd"
  const firstAvailable = TABS.find((t) => enrichmentMap.has(t.key));
  const defaultTab = firstAvailable?.key ?? "nvd";

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList variant="line" className="mb-4 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => {
          const hasData = enrichmentMap.has(key);
          return (
            <TabsTrigger key={key} value={key} className="gap-1.5">
              <Icon className="size-3.5" />
              {label}
              {hasData && (
                <span className="size-1.5 rounded-full bg-emerald-500" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="nvd">
        {enrichmentMap.has("nvd") ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <NvdSection
                data={enrichmentMap.get("nvd")!.data as NvdData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="NVD" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="epss">
        {enrichmentMap.has("epss") ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <EpssSection
                data={enrichmentMap.get("epss")!.data as EpssData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="EPSS" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="kev">
        {enrichmentMap.has("kev") ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <KevSection
                data={enrichmentMap.get("kev")!.data as KevData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="KEV" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="bdu">
        {enrichmentMap.has("bdu") ? (
          <Card className="border-amber-800/40 bg-amber-950/10">
            <CardContent className="pt-5">
              <BduSection
                data={enrichmentMap.get("bdu")!.data as BduData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="БДУ" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="osv">
        {enrichmentMap.has("osv") ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <OsvSection
                data={enrichmentMap.get("osv")!.data as OsvData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="OSV" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="cwe">
        {enrichmentMap.has("cwe") ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <CweSection
                data={enrichmentMap.get("cwe")!.data as CweData}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="CWE" findingId={findingId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
