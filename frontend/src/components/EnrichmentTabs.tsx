import { useState } from "react";
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  Bug,
  Package,
  BookOpen,
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
import CweSection, { type CweEntry } from "@/components/enrichment/CweSection";

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
        {enrichmentMap.get("cwe")?.data ? (
          <CweSection
            entries={(enrichmentMap.get("cwe")?.data as CweEntry[] | undefined) ?? []}
          />
        ) : (
          <EmptyState label="CWE" findingId={findingId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
