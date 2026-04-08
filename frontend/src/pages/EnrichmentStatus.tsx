import type { ComponentType } from "react";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Shield,
  TrendingUp,
  AlertTriangle,
  Bug,
  BookOpen,
  Cpu,
  Package,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEnrichmentStatus,
  useTriggerSync,
  type EnrichmentSyncStatus,
} from "@/api/enrichment";
import { cn } from "@/lib/utils";

interface SourceMeta {
  key: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

type SyncStatus = EnrichmentSyncStatus;

const SOURCE_META: SourceMeta[] = [
  {
    key: "nvd",
    label: "NVD",
    description: "NIST National Vulnerability Database",
    icon: Shield,
    color: "text-blue-400",
  },
  {
    key: "epss",
    label: "EPSS",
    description: "Exploit Prediction Scoring System",
    icon: TrendingUp,
    color: "text-violet-400",
  },
  {
    key: "kev",
    label: "CISA KEV",
    description: "Known Exploited Vulnerabilities",
    icon: AlertTriangle,
    color: "text-red-400",
  },
  {
    key: "bdu",
    label: "БДУ ФСТЭК",
    description: "База данных угроз ФСТЭК России",
    icon: Bug,
    color: "text-amber-400",
  },
  {
    key: "osv",
    label: "OSV",
    description: "Open Source Vulnerabilities",
    icon: Package,
    color: "text-emerald-400",
  },
  {
    key: "cwe",
    label: "CWE",
    description: "Common Weakness Enumeration",
    icon: BookOpen,
    color: "text-cyan-400",
  },
  {
    key: "cpe",
    label: "CPE",
    description: "Common Platform Enumeration",
    icon: Cpu,
    color: "text-pink-400",
  },
];

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Badge className="gap-1 border-blue-800 bg-blue-950/50 text-blue-400">
          <Loader2 className="size-3 animate-spin" />
          Синхронизация
        </Badge>
      );
    case "success":
      return (
        <Badge className="gap-1 border-emerald-800 bg-emerald-950/50 text-emerald-400">
          <CheckCircle2 className="size-3" />
          Успешно
        </Badge>
      );
    case "error":
      return (
        <Badge className="gap-1 border-red-800 bg-red-950/50 text-red-400">
          <XCircle className="size-3" />
          Ошибка
        </Badge>
      );
    default:
      return (
        <Badge className="gap-1 border-zinc-700 bg-zinc-800/50 text-zinc-400">
          <Clock className="size-3" />
          Ожидание
        </Badge>
      );
  }
}

function formatDurationSeconds(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}с`;

  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;

  return remainSec > 0 ? `${minutes}м ${remainSec}с` : `${minutes}м`;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}


function SourceCard({
  meta,
  status,
  isSyncing,
  onSync,
}: {
  meta: SourceMeta;
  status?: SyncStatus;
  isSyncing: boolean;
  onSync: () => void;
}) {
  const Icon = meta.icon;
  const syncStatus = status?.status ?? "pending";
  const disabled = isSyncing || syncStatus === "running";

  return (
    <Card
      className={cn(
        "border-zinc-800 bg-zinc-900/50 transition-colors",
        syncStatus === "error" && "border-red-900/50",
        syncStatus === "running" && "border-blue-900/50",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg bg-zinc-800/80",
                meta.color,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                {meta.label}
              </CardTitle>
              <p className="text-xs text-zinc-500">{meta.description}</p>
            </div>
          </div>
          <StatusIndicator status={syncStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-xs text-zinc-500">
              Последняя синхронизация
            </span>
            <p className="text-zinc-300">
              {status?.last_sync_at
                ? formatDistanceToNow(new Date(status.last_sync_at), {
                  addSuffix: true,
                  locale: ru,
                })
                : "—"}
            </p>
          </div>

          <div>
            <span className="text-xs text-zinc-500">Записей в базе</span>
            <p className="font-mono text-zinc-300">
              {status ? formatCount(status.records_count) : "—"}
            </p>
          </div>

          <div>
            <span className="text-xs text-zinc-500">Длительность</span>
            <p className="text-zinc-300">
              {status ? formatDurationSeconds(status.duration_seconds) : "—"}
            </p>
          </div>

          <div>
            <span className="text-xs text-zinc-500">Источник</span>
            <p className="text-zinc-300">{meta.label}</p>
          </div>
        </div>

        {status?.error_message && (
          <div className="rounded-md bg-red-950/30 px-3 py-2 text-xs leading-relaxed text-red-400">
            {status.error_message}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={disabled}
          className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {disabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {disabled ? "Синхронизация..." : "Синхронизировать"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CompactStat({
  icon: Icon,
  label,
  value,
  tone = "zinc",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "zinc" | "emerald" | "blue" | "red";
}) {
  const toneMap = {
    zinc: {
      wrap: "border-zinc-800 bg-zinc-950/60",
      icon: "text-zinc-400",
      label: "text-zinc-500",
      value: "text-zinc-100",
    },
    emerald: {
      wrap: "border-emerald-900/40 bg-emerald-950/20",
      icon: "text-emerald-400",
      label: "text-emerald-400/80",
      value: "text-emerald-300",
    },
    blue: {
      wrap: "border-blue-900/40 bg-blue-950/20",
      icon: "text-blue-400",
      label: "text-blue-400/80",
      value: "text-blue-300",
    },
    red: {
      wrap: "border-red-900/40 bg-red-950/20",
      icon: "text-red-400",
      label: "text-red-400/80",
      value: "text-red-300",
    },
  };

  const styles = toneMap[tone];

  return (
    <div className={cn("rounded-lg border p-3", styles.wrap)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", styles.icon)} />
        <span className={cn("text-[11px]", styles.label)}>{label}</span>
      </div>
      <div className={cn("mt-2 text-xl font-semibold leading-none", styles.value)}>
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ statuses }: { statuses: SyncStatus[] }) {
  const trackedStatuses = SOURCE_META.map((meta) =>
    statuses.find((status) => status.source === meta.key),
  ).filter((status): status is SyncStatus => Boolean(status));

  const totalSources = SOURCE_META.length;
  const totalRecords = trackedStatuses.reduce(
    (sum, status) => sum + status.records_count,
    0,
  );
  const successCount = trackedStatuses.filter(
    (status) => status.status === "success",
  ).length;
  const runningCount = trackedStatuses.filter(
    (status) => status.status === "running",
  ).length;
  const errorCount = trackedStatuses.filter(
    (status) => status.status === "error",
  ).length;
  const pendingCount = Math.max(totalSources - trackedStatuses.length, 0);

  const latestSyncAt = trackedStatuses
    .filter((status) => Boolean(status.last_sync_at))
    .map((status) => new Date(status.last_sync_at as string).getTime())
    .sort((a, b) => b - a)[0];

  const successPct = totalSources > 0 ? (successCount / totalSources) * 100 : 0;
  const runningPct = totalSources > 0 ? (runningCount / totalSources) * 100 : 0;
  const errorPct = totalSources > 0 ? (errorCount / totalSources) * 100 : 0;
  const pendingPct = Math.max(100 - successPct - runningPct - errorPct, 0);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Database className="size-4 text-violet-400" />
              Сводка по enrichment
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Короткий статус по источникам и синхронизации
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1">
              Источников: {totalSources}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1">
              В БД: {trackedStatuses.length}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStat
            icon={Database}
            label="Всего записей"
            value={formatCount(totalRecords)}
            tone="zinc"
          />
          <CompactStat
            icon={CheckCircle2}
            label="Успешно"
            value={successCount}
            tone="emerald"
          />
          <CompactStat
            icon={Loader2}
            label="В работе"
            value={runningCount}
            tone="blue"
          />
          <CompactStat
            icon={XCircle}
            label="Ошибки"
            value={errorCount}
            tone="red"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Распределение статусов</span>
            <span>
              pending: {pendingCount} / {totalSources}
            </span>
          </div>

          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
            {successPct > 0 && (
              <div
                className="bg-emerald-500"
                style={{ width: `${successPct}%` }}
                title={`Успешно: ${successCount}`}
              />
            )}
            {runningPct > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${runningPct}%` }}
                title={`В работе: ${runningCount}`}
              />
            )}
            {errorPct > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${errorPct}%` }}
                title={`Ошибки: ${errorCount}`}
              />
            )}
            {pendingPct > 0 && (
              <div
                className="bg-zinc-600"
                style={{ width: `${pendingPct}%` }}
                title={`Ожидают: ${pendingCount}`}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1 text-emerald-300">
              <CheckCircle2 className="size-3" />
              Успешно: {successCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-900/40 bg-blue-950/20 px-2.5 py-1 text-blue-300">
              <Loader2 className="size-3" />
              В работе: {runningCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-900/40 bg-red-950/20 px-2.5 py-1 text-red-300">
              <XCircle className="size-3" />
              Ошибки: {errorCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-zinc-400">
              <Clock className="size-3" />
              Ожидают: {pendingCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-zinc-400">
              Последняя активность:{" "}
              {latestSyncAt
                ? formatDistanceToNow(new Date(latestSyncAt), {
                    addSuffix: true,
                    locale: ru,
                  })
                : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64 bg-zinc-800/50" />
      <Skeleton className="h-56 bg-zinc-800/50" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-56 bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}

export default function EnrichmentStatus() {
  const { data, isLoading } = useEnrichmentStatus();
  const triggerSync = useTriggerSync();

  if (isLoading) return <LoadingSkeleton />;

  const sources: SyncStatus[] = data?.data ?? [];
  const sourceMap = new Map(sources.map((status) => [status.source, status]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Мониторинг обогащения
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Статус синхронизации источников данных об уязвимостях. Обновление
          каждые 30 секунд.
        </p>
      </div>

      <SummaryCard statuses={sources} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Источники данных
        </h2>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {SOURCE_META.map((meta) => (
            <SourceCard
              key={meta.key}
              meta={meta}
              status={sourceMap.get(meta.key)}
              isSyncing={
                triggerSync.isPending && triggerSync.variables === meta.key
              }
              onSync={() => triggerSync.mutate(meta.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}