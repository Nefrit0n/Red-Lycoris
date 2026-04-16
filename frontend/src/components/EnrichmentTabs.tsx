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
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useEnrichFinding, useFindingEnrichments } from "@/api/enrichment";
import type { FindingEnrichment } from "@/types";
import NvdSection, { type NvdEntry } from "@/components/enrichment/NvdSection";
import EpssSection, { type EpssEntry } from "@/components/enrichment/EpssSection";
import KevSection, { type KevEntry } from "@/components/enrichment/KevSection";
import OsvSection, { type OsvEntry } from "@/components/enrichment/OsvSection";
import BduSection, { type BduEntry } from "@/components/enrichment/BduSection";

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
  findingId,
}: {
  label: string;
  findingId: string;
}) {
  const enrichFinding = useEnrichFinding();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 py-8 text-sm text-zinc-600">
      <p>Нет данных из {label}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => enrichFinding.mutate(findingId)}
        disabled={enrichFinding.isPending}
        className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
      >
        {enrichFinding.isPending ? (
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
  findingComponent?: string;
}

export default function EnrichmentTabs({ findingId, findingComponent }: EnrichmentTabsProps) {
  const { data, isLoading } = useFindingEnrichments(findingId);
  const enrichments = data?.data ?? [];

  if (isLoading) return <EnrichmentSkeleton />;

  const enrichmentMap = new Map<string, FindingEnrichment>(
    enrichments.map((e) => [e.source.toLowerCase(), e] as const),
  );

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
        {enrichmentMap.get("nvd")?.data ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <NvdSection
                entries={((enrichmentMap.get("nvd")?.data as NvdEntry[] | undefined) ?? [])}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="NVD" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="epss">
        {enrichmentMap.get("epss")?.data ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <EpssSection
                entries={
                  ((enrichmentMap.get("epss")?.data as EpssEntry[] | undefined) ??
                    [])
                }
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="EPSS" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="kev">
        {enrichmentMap.get("kev")?.data ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <KevSection
                entries={((enrichmentMap.get("kev")?.data as KevEntry[] | undefined) ?? [])}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="KEV" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="bdu">
        {enrichmentMap.get("bdu")?.data ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <BduSection
                entries={((enrichmentMap.get("bdu")?.data as BduEntry[] | undefined) ?? [])}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="БДУ" findingId={findingId} />
        )}
      </TabsContent>

      <TabsContent value="osv">
        {enrichmentMap.get("osv")?.data ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-5">
              <OsvSection
                entries={((enrichmentMap.get("osv")?.data as OsvEntry[] | undefined) ?? [])}
                findingComponent={findingComponent}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyState label="OSV" findingId={findingId} />
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
          <EmptyState label="CWE" findingId={findingId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
