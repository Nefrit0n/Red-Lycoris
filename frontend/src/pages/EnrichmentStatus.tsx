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
import { useEnrichmentStatus, useTriggerSync } from "@/api/enrichment";
import { cn } from "@/lib/utils";

interface SourceMeta {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface SyncStatus {
  source: string;
  last_sync_at: string | null;
  records_count: number;
  status: "running" | "success" | "error" | string;
  error_message?: string;
  duration_seconds: number;
}

const SOURCE_META: SourceMeta[] = [
  {
    key: "nvd",
    label: "NVD",
    description: "Национальная база уязвимостей NIST",
    icon: Shield,
    color: "text-blue-400",
  },
  {
    key: "epss",
    label: "EPSS",
    description: "Система оценки вероятности эксплуатации",
    icon: TrendingUp,
    color: "text-red-500",
  },
  {
    key: "kev",
    label: "CISA KEV",
    description: "Известные эксплуатируемые уязвимости",
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
    description: "Уязвимости Open Source",
    icon: Package,
    color: "text-emerald-400",
  },
  {
    key: "cwe",
    label: "CWE",
    description: "Перечень распространённых слабостей",
    icon: BookOpen,
    color: "text-cyan-400",
  },
  {
    key: "cpe",
    label: "CPE",
    description: "Перечень платформ",
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

function SummaryCard({
  statuses,
}: {
  statuses: SyncStatus[];
}) {
  const totalRecords = statuses.reduce((acc, item) => acc + (item.records_count || 0), 0);
  const successCount = statuses.filter((item) => item.status === "success").length;
  const runningCount = statuses.filter((item) => item.status === "running").length;
  const errorCount = statuses.filter((item) => item.status === "error").length;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Database className="size-4 text-red-500" />
          Сводка по источникам
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Текущее состояние синхронизации enrichment-источников
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="text-xs text-zinc-500">Всего записей</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">
              {formatCount(totalRecords)}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
            <div className="text-xs text-emerald-400/80">Успешных источников</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">
              {successCount}
            </div>
          </div>

          <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">
            <div className="text-xs text-blue-400/80">Сейчас синхронизируются</div>
            <div className="mt-1 text-2xl font-semibold text-blue-400">
              {runningCount}
            </div>
          </div>

          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4">
            <div className="text-xs text-red-400/80">С ошибками</div>
            <div className="mt-1 text-2xl font-semibold text-red-400">
              {errorCount}
            </div>
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
      <Skeleton className="h-40 bg-zinc-800/50" />
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
  const sourceMap = new Map(sources.map((s) => [s.source, s]));

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