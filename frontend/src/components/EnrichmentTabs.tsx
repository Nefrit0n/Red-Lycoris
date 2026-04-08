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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useFindingEnrichments, useTriggerSync } from "@/api/enrichment";
import { cn } from "@/lib/utils";

/* ── NVD ────────────────────────────────────────────────── */

interface NvdData {
  cve_id?: string;
  cvss_v3_vector?: string;
  cvss_v3_score?: number;
  cvss_v31_vector?: string;
  cvss_v31_score?: number;
  cvss_v40_vector?: string;
  cvss_v40_score?: number;
  cvss_v2_score?: number;
  description?: string;
  published?: string;
  published_at?: string;
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
  const cvssV3Score = data.cvss_v3_score ?? data.cvss_v31_score;
  const cvssV3Vector = data.cvss_v3_vector ?? data.cvss_v31_vector;
  const published = data.published ?? data.published_at;

  return (
    <div className="space-y-4">
      {cvssV3Score != null && (
        <div className="flex items-start gap-6">
          <CvssGauge score={cvssV3Score} />
          <div className="flex-1 space-y-2">
            {cvssV3Vector && (
              <div>
                <span className="text-xs text-zinc-500">Vector String</span>
                <code className="mt-0.5 block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  {cvssV3Vector}
                </code>
              </div>
            )}
            {published && (
              <div>
                <span className="text-xs text-zinc-500">Опубликовано</span>
                <p className="text-sm text-zinc-300">{published}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {data.cvss_v2_score != null && cvssV3Score == null && (
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
                  className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
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
  cve_id?: string;
  score?: number;
  epss_score?: number;
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
  const score = data.score ?? data.epss_score ?? 0;
  const scorePct = score * 100;
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
  cve_id?: string;
  date_added?: string;
  due_date?: string;
  known_ransomware?: boolean;
  known_ransomware_campaign_use?: string;
  notes?: string;
  vulnerability_name?: string;
}

function KevSection({ data }: { data: KevData }) {
  const isKnownRansomware =
    data.known_ransomware_campaign_use === "Known" || data.known_ransomware;

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

      {isKnownRansomware && (
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
  bdu_id?: string;
  identifier?: string;
  name?: string;
  description?: string;
  remediation?: string;
  severity?: string;
}

function BduSection({ data }: { data: BduData }) {
  const identifier = data.identifier ?? data.bdu_id;

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
        {identifier && (
          <Badge className="border-amber-800 bg-amber-950/50 font-mono text-amber-400">
            {identifier}
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
  osv_id?: string;
  summary?: string;
  aliases?: string[];
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: {
      events?: { fixed?: string; introduced?: string }[];
    }[];
  }[];
}

function OsvSection({ data }: { data: OsvData }) {
  const osvId = data.id ?? data.osv_id;

  return (
    <div className="space-y-4">
      {osvId && (
        <a
          href={`https://osv.dev/vulnerability/${osvId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-sm text-violet-400 hover:underline"
        >
          {osvId}
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
  cwe_id?: number;
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
  const cweId = data.id ?? data.cwe_id;

  return (
    <div className="space-y-4">
      {cweId && (
        <a
          href={`https://cwe.mitre.org/data/definitions/${cweId}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-sm text-blue-400 hover:underline"
        >
          CWE-{cweId}
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

function getEnrichmentData<T extends object>(
  raw: unknown,
): T | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object") {
      return first as T;
    }
    return undefined;
  }

  if (typeof raw === "object") {
    return raw as T;
  }

  return undefined;
}

function EmptyState({
  label,
  source,
}: {
  label: string;
  source: string;
}) {
  const triggerSync = useTriggerSync();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 py-8 text-sm text-zinc-600">
      <p>Нет данных из {label}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => triggerSync.mutate(source)}
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
        {getEnrichmentData<NvdData>(enrichmentMap.get("nvd")?.data) ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <NvdSection
                data={
                  getEnrichmentData<NvdData>(enrichmentMap.get("nvd")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="NVD" source="nvd" />
        )}
      </TabsContent>

      <TabsContent value="epss">
        {getEnrichmentData<EpssData>(enrichmentMap.get("epss")?.data) ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <EpssSection
                data={
                  getEnrichmentData<EpssData>(enrichmentMap.get("epss")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="EPSS" source="epss" />
        )}
      </TabsContent>

      <TabsContent value="kev">
        {getEnrichmentData<KevData>(enrichmentMap.get("kev")?.data) ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <KevSection
                data={
                  getEnrichmentData<KevData>(enrichmentMap.get("kev")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="KEV" source="kev" />
        )}
      </TabsContent>

      <TabsContent value="bdu">
        {getEnrichmentData<BduData>(enrichmentMap.get("bdu")?.data) ? (
          <Card className="border-amber-800/40 bg-amber-950/10">
            <CardContent className="pt-5">
              <BduSection
                data={
                  getEnrichmentData<BduData>(enrichmentMap.get("bdu")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="БДУ" source="bdu" />
        )}
      </TabsContent>

      <TabsContent value="osv">
        {getEnrichmentData<OsvData>(enrichmentMap.get("osv")?.data) ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <OsvSection
                data={
                  getEnrichmentData<OsvData>(enrichmentMap.get("osv")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="OSV" source="osv" />
        )}
      </TabsContent>

      <TabsContent value="cwe">
        {getEnrichmentData<CweData>(enrichmentMap.get("cwe")?.data) ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <CweSection
                data={
                  getEnrichmentData<CweData>(enrichmentMap.get("cwe")?.data)!
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="CWE" source="cwe" />
        )}
      </TabsContent>
    </Tabs>
  );
}
