import { useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  GitBranchIcon,
  ExternalLinkIcon,
  ContainerIcon,
  Code2Icon,
  KeyIcon,
  ShieldIcon,
  LayersIcon,
  ZapIcon,
  PackageIcon,
  ScanIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useProjectScans,
  useScan,
  type ScanFindingItem,
  type ScanItem,
  type ScanStatus,
  type ScanToolRun,
} from "@/api/project-security";

// ─── Вспомогательные функции ────────────────────────────────────────────────

function relTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

function shortSha(sha: string | null | undefined) {
  return sha ? sha.slice(0, 8) : "—";
}

// ─── Статусы сканов ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ScanStatus, { label: string; dotClass: string; badgeClass: string; tip?: string }> = {
  open: {
    label: "Выполняется",
    dotClass: "bg-blue-400 animate-pulse",
    badgeClass: "border-blue-800 bg-blue-950 text-blue-300",
  },
  completed: {
    label: "Завершён",
    dotClass: "bg-emerald-400",
    badgeClass: "border-emerald-800 bg-emerald-950 text-emerald-300",
  },
  timed_out: {
    label: "Истёк таймаут",
    dotClass: "bg-amber-400",
    badgeClass: "border-amber-800 bg-amber-950 text-amber-300",
    tip: "Скан закрыт по таймауту — мог не завершиться полностью. Данные могут быть неполными.",
  },
};

// ─── Маппинг сканеров ────────────────────────────────────────────────────────

type ScannerDef = {
  icon: React.ElementType;
  colorClass: string;
  label: string;
};

const SCANNER_MAP: Record<string, ScannerDef> = {
  trivy:      { icon: ContainerIcon, colorClass: "text-sky-400",    label: "Trivy" },
  grype:      { icon: PackageIcon,   colorClass: "text-blue-400",   label: "Grype" },
  semgrep:    { icon: Code2Icon,     colorClass: "text-violet-400", label: "Semgrep" },
  opengrep:   { icon: Code2Icon,     colorClass: "text-violet-400", label: "Opengrep" },
  sarif:      { icon: Code2Icon,     colorClass: "text-violet-400", label: "SARIF" },
  gosec:      { icon: ShieldIcon,    colorClass: "text-emerald-400",label: "gosec" },
  trufflehog: { icon: KeyIcon,       colorClass: "text-amber-400",  label: "TruffleHog" },
  gitleaks:   { icon: KeyIcon,       colorClass: "text-rose-400",   label: "Gitleaks" },
  checkov:    { icon: LayersIcon,    colorClass: "text-indigo-400", label: "Checkov" },
  zap:        { icon: ZapIcon,       colorClass: "text-yellow-400", label: "ZAP" },
};

function getScannerDef(scanner: string): ScannerDef {
  return SCANNER_MAP[scanner.toLowerCase()] ?? {
    icon: ScanIcon,
    colorClass: "text-zinc-400",
    label: scanner,
  };
}

// ─── Иконки инструментов в строке списка ─────────────────────────────────────

function ToolRunIcons({ toolRuns }: { toolRuns: ScanItem["tool_runs"] }) {
  if (!toolRuns || toolRuns.length === 0) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      {toolRuns.map((tr, i) => {
        const def = getScannerDef(tr.scanner);
        const Icon = def.icon;
        return (
          <span
            key={i}
            className="relative inline-flex items-center"
            title={`${def.label}${tr.scanner_version ? ` ${tr.scanner_version}` : ""}${tr.status === "failed" ? " — ошибка парсинга" : ""}`}
          >
            <Icon className={`h-4 w-4 ${def.colorClass} ${tr.status === "failed" ? "opacity-50" : ""}`} />
            {tr.status === "failed" && (
              <XCircleIcon className="absolute -right-1 -top-1 h-2.5 w-2.5 text-red-500" />
            )}
          </span>
        );
      })}
    </span>
  );
}

// ─── Бэйдж severity ───────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<number, string> = { 0: "info", 1: "low", 2: "medium", 3: "high", 4: "critical" };
const SEVERITY_COLOR: Record<number, string> = {
  0: "text-zinc-400", 1: "text-sky-400", 2: "text-yellow-400", 3: "text-orange-400", 4: "text-red-400",
};

// ─── Строка finding ──────────────────────────────────────────────────────────

function ScanFindingRow({ f }: { f: ScanFindingItem }) {
  return (
    <div className="flex items-start gap-2 rounded border border-zinc-800 p-2 text-sm">
      {f.is_new && (
        <Badge className="shrink-0 bg-emerald-700 text-emerald-100 text-xs">новая</Badge>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 text-xs font-medium ${SEVERITY_COLOR[f.severity] ?? "text-zinc-400"}`}>
            {SEVERITY_LABEL[f.severity] ?? "?"}
          </span>
          <span className="truncate text-zinc-100">{f.title}</span>
        </div>
        {f.file_path && (
          <div className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            {f.file_path}{f.line_start ? `:${f.line_start}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Секция findings одного tool-run с виртуализацией ────────────────────────

function ToolRunFindingsSection({ findings }: { findings: ScanFindingItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  if (findings.length === 0) {
    return <p className="py-2 text-xs text-zinc-600">Нет находок.</p>;
  }

  return (
    <div ref={parentRef} className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => (
          <div
            key={vItem.key}
            style={{
              position: "absolute",
              top: vItem.start,
              left: 0,
              right: 0,
              height: vItem.size,
            }}
          >
            <ScanFindingRow f={findings[vItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Карточка tool-run с разворотом ──────────────────────────────────────────

function ToolRunCard({
  toolRun,
  findings,
}: {
  toolRun: ScanToolRun;
  findings: ScanFindingItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const def = getScannerDef(toolRun.scanner);
  const Icon = def.icon;
  const isFailed = toolRun.status === "failed";

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900">
      <button
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800/40"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Иконка инструмента */}
        <Icon className={`h-4 w-4 shrink-0 ${def.colorClass} ${isFailed ? "opacity-50" : ""}`} />

        {/* Название + версия */}
        <span className="flex-1 text-sm font-medium text-zinc-100">
          {def.label}
          {toolRun.scanner_version && (
            <span className="ml-1.5 font-mono text-xs text-zinc-500">{toolRun.scanner_version}</span>
          )}
          <span className="ml-1.5 text-xs text-zinc-600">{toolRun.report_format}</span>
        </span>

        {/* Статус */}
        {isFailed ? (
          <Badge className="bg-red-900/50 text-red-300 text-xs">ошибка</Badge>
        ) : (
          <span className="text-xs text-zinc-400">
            +{toolRun.findings_imported} / ~{toolRun.findings_updated}
          </span>
        )}

        {/* Развернуть */}
        {expanded
          ? <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          : <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        }
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2">
          {isFailed && toolRun.error && (
            <div className="mb-2 rounded bg-red-950/40 px-2 py-1.5 font-mono text-xs text-red-300">
              {toolRun.error}
            </div>
          )}
          <ToolRunFindingsSection findings={findings} />
        </div>
      )}
    </div>
  );
}

// ─── Drawer с деталями скана ─────────────────────────────────────────────────

function ScanDrawer({ scan, onClose }: { scan: ScanItem; onClose: () => void }) {
  const detailQuery = useScan(scan.id);
  const detail = detailQuery.data?.data;
  const toolRuns = detail?.tool_runs ?? [];
  const allFindings = detail?.findings ?? [];
  const cfg = STATUS_CONFIG[scan.status];

  // Группируем findings по tool_run_id.
  const findingsByToolRun = useMemo(() => {
    const map = new Map<string, ScanFindingItem[]>();
    for (const f of allFindings) {
      const key = f.tool_run_id ?? "__none__";
      const arr = map.get(key);
      if (arr) arr.push(f);
      else map.set(key, [f]);
    }
    return map;
  }, [allFindings]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-base">Детали скана</DialogTitle>
        </DialogHeader>

        {/* Шапка */}
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${cfg.badgeClass}`}
              title={cfg.tip}
            >
              {scan.status === "timed_out" && <ClockIcon className="h-3 w-3" />}
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
              {cfg.label}
            </span>
            {scan.status === "timed_out" && cfg.tip && (
              <span className="text-xs text-amber-400/80">{cfg.tip}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-zinc-400">
            {scan.branch && (
              <span className="flex items-center gap-1">
                <GitBranchIcon className="h-3.5 w-3.5" />
                {scan.branch}
              </span>
            )}
            {scan.commit_sha && (
              <span
                className="cursor-copy font-mono text-xs"
                onClick={() => navigator.clipboard.writeText(scan.commit_sha!)}
                title="Нажмите чтобы скопировать"
              >
                {shortSha(scan.commit_sha)}
              </span>
            )}
            <span>{relTime(scan.started_at)}</span>
            {scan.completed_at && (
              <span className="text-zinc-600">→ {relTime(scan.completed_at)}</span>
            )}
            {scan.ci_job_url && (
              <a
                href={scan.ci_job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:underline"
              >
                CI job <ExternalLinkIcon className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            Итого: +{scan.findings_imported} новых / ~{scan.findings_updated} обновлено
          </div>
        </div>

        {/* Секции по tool-run */}
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {detailQuery.isLoading && (
            <p className="text-sm text-zinc-500">Загрузка…</p>
          )}
          {detailQuery.isError && (
            <p className="text-sm text-red-400">Не удалось загрузить детали скана.</p>
          )}
          {!detailQuery.isLoading && toolRuns.length === 0 && (
            <p className="text-sm text-zinc-500">Нет запусков инструментов в этом скане.</p>
          )}
          {toolRuns.map((tr) => (
            <ToolRunCard
              key={tr.id}
              toolRun={tr}
              findings={findingsByToolRun.get(tr.id) ?? []}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Главный компонент: список сканов ────────────────────────────────────────

export default function ProjectScans({ projectId }: { projectId: string }) {
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedScan, setSelectedScan] = useState<ScanItem | null>(null);

  const params: Record<string, string> = {};
  if (branch.trim()) params.branch = branch.trim();
  if (status !== "all") params.status = status;
  if (cursor) params.cursor = cursor;

  const scansQuery = useProjectScans(projectId, params);
  const scans = scansQuery.data?.data ?? [];
  const nextCursor = scansQuery.data?.meta?.next_cursor;
  const hasFilters = branch !== "" || status !== "all";

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Ветка…"
          value={branch}
          onChange={(e) => { setBranch(e.target.value); setCursor(undefined); }}
          className="h-8 w-48 border-zinc-700 bg-zinc-800 text-sm"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v ?? "all"); setCursor(undefined); }}>
          <SelectTrigger className="h-8 w-40 border-zinc-700 bg-zinc-800 text-sm">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="completed">Завершён</SelectItem>
            <SelectItem value="open">Выполняется</SelectItem>
            <SelectItem value="timed_out">Истёк таймаут</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-zinc-400"
            onClick={() => { setBranch(""); setStatus("all"); setCursor(undefined); }}
          >
            Сбросить
          </Button>
        )}
      </div>

      {/* Список сканов */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сканы</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scansQuery.isLoading && (
            <p className="px-4 py-6 text-sm text-zinc-500">Загрузка…</p>
          )}
          {scansQuery.isError && (
            <p className="px-4 py-6 text-sm text-red-400">Ошибка загрузки сканов.</p>
          )}
          {!scansQuery.isLoading && scans.length === 0 && (
            <p className="px-4 py-6 text-sm text-zinc-500">Нет сканов по заданным фильтрам.</p>
          )}
          {scans.map((s) => {
            const cfg = STATUS_CONFIG[s.status];
            return (
              <button
                key={s.id}
                className="flex w-full items-center gap-3 border-b border-zinc-800 px-4 py-3 text-left last:border-0 hover:bg-zinc-800/50"
                onClick={() => setSelectedScan(s)}
              >
                {/* Статус-точка */}
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${cfg.dotClass}`}
                  title={cfg.label}
                />

                {/* Время */}
                <span className="w-28 shrink-0 text-xs text-zinc-400">
                  {relTime(s.started_at)}
                </span>

                {/* Иконки инструментов */}
                <span className="w-24 shrink-0">
                  <ToolRunIcons toolRuns={s.tool_runs} />
                </span>

                {/* Ветка + коммит */}
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
                  {s.branch && (
                    <>
                      <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="truncate text-zinc-300">{s.branch}</span>
                    </>
                  )}
                  {s.commit_sha && (
                    <span
                      className="shrink-0 cursor-copy font-mono text-xs text-zinc-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(s.commit_sha!);
                      }}
                      title="Скопировать полный SHA"
                    >
                      {shortSha(s.commit_sha)}
                    </span>
                  )}
                </span>

                {/* Статус-бэйдж для timed_out */}
                {s.status === "timed_out" && (
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${cfg.badgeClass}`}
                    title={cfg.tip}
                  >
                    <ClockIcon className="mr-0.5 inline h-3 w-3" />
                    таймаут
                  </span>
                )}

                {/* Счётчики */}
                <span className="w-20 shrink-0 text-right text-xs text-zinc-400">
                  +{s.findings_imported} / ~{s.findings_updated}
                </span>

                {/* CI ссылка */}
                {s.ci_job_url ? (
                  <a
                    href={s.ci_job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Пагинация */}
      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700"
            onClick={() => setCursor(nextCursor)}
          >
            Загрузить ещё
          </Button>
        </div>
      )}

      {/* Drawer */}
      {selectedScan && (
        <ScanDrawer scan={selectedScan} onClose={() => setSelectedScan(null)} />
      )}
    </div>
  );
}
