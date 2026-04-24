import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { GitBranchIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectScans, useScan, type ScanFindingItem, type ScanItem } from "@/api/project-security";

function relTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

const STATUS_CONFIG: Record<
  ScanItem["status"],
  { label: string; dot: string }
> = {
  running:   { label: "Выполняется", dot: "bg-blue-400 animate-pulse" },
  completed: { label: "Завершён",    dot: "bg-emerald-400" },
  failed:    { label: "Ошибка",      dot: "bg-red-400" },
};

const SCANNER_COLORS: Record<string, string> = {
  trivy:       "bg-sky-900 text-sky-300",
  opengrep:    "bg-violet-900 text-violet-300",
  semgrep:     "bg-violet-900 text-violet-300",
  trufflehog:  "bg-amber-900 text-amber-300",
  gitleaks:    "bg-rose-900 text-rose-300",
};

function scannerBadgeClass(scanner: string) {
  return SCANNER_COLORS[scanner.toLowerCase()] ?? "bg-zinc-800 text-zinc-300";
}

const SEVERITY_LABEL: Record<number, string> = {
  0: "info", 1: "low", 2: "medium", 3: "high", 4: "critical",
};
const SEVERITY_COLOR: Record<number, string> = {
  0: "text-zinc-400", 1: "text-sky-400", 2: "text-yellow-400",
  3: "text-orange-400", 4: "text-red-400",
};

function ScanFindingRow({ f }: { f: ScanFindingItem }) {
  return (
    <div className="flex items-start gap-2 rounded border border-zinc-800 p-2 text-sm">
      {f.is_new && (
        <Badge className="shrink-0 bg-emerald-700 text-emerald-100 text-xs">новый</Badge>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${SEVERITY_COLOR[f.severity] ?? "text-zinc-400"}`}>
            {SEVERITY_LABEL[f.severity] ?? "?"}
          </span>
          <span className="truncate">{f.title}</span>
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

function ScanDrawer({ scan, onClose }: { scan: ScanItem; onClose: () => void }) {
  const detailQuery = useScan(scan.id);
  const findings = detailQuery.data?.data.findings ?? [];
  const cfg = STATUS_CONFIG[scan.status];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-base">Детали скана</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 font-medium`}>
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${scannerBadgeClass(scan.scanner)}`}>
              {scan.scanner}
              {scan.scanner_version ? ` ${scan.scanner_version}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-zinc-400">
            <span className="flex items-center gap-1">
              <GitBranchIcon className="h-3.5 w-3.5" />
              {scan.branch}
            </span>
            <span
              className="cursor-copy font-mono text-xs"
              onClick={() => navigator.clipboard.writeText(scan.commit_sha)}
              title="Нажмите чтобы скопировать"
            >
              {scan.commit_sha.slice(0, 8)}
            </span>
            <span>{relTime(scan.started_at)}</span>
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
            Импортировано: {scan.findings_imported} · Обновлено: {scan.findings_updated}
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {detailQuery.isLoading && (
            <p className="text-sm text-zinc-500">Загрузка находок…</p>
          )}
          {findings.length === 0 && !detailQuery.isLoading && (
            <p className="text-sm text-zinc-500">Нет находок в этом скане.</p>
          )}
          {findings.map((f) => (
            <ScanFindingRow key={f.id} f={f} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectScans({ projectId }: { projectId: string }) {
  const [branch, setBranch] = useState("");
  const [scanner, setScanner] = useState("all");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedScan, setSelectedScan] = useState<ScanItem | null>(null);

  const params: Record<string, string> = {};
  if (branch.trim()) params.branch = branch.trim();
  if (scanner !== "all") params.scanner = scanner;
  if (status !== "all") params.status = status;
  if (cursor) params.cursor = cursor;

  const scansQuery = useProjectScans(projectId, params);
  const scans = scansQuery.data?.data ?? [];
  const nextCursor = scansQuery.data?.meta?.next_cursor;

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
        <Select value={scanner} onValueChange={(v) => { setScanner(v ?? "all"); setCursor(undefined); }}>
          <SelectTrigger className="h-8 w-36 border-zinc-700 bg-zinc-800 text-sm">
            <SelectValue placeholder="Сканер" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all">Все сканеры</SelectItem>
            {["trivy", "opengrep", "semgrep", "trufflehog", "gitleaks"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v ?? "all"); setCursor(undefined); }}>
          <SelectTrigger className="h-8 w-36 border-zinc-700 bg-zinc-800 text-sm">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="completed">Завершён</SelectItem>
            <SelectItem value="failed">Ошибка</SelectItem>
            <SelectItem value="running">Выполняется</SelectItem>
          </SelectContent>
        </Select>
        {(branch || scanner !== "all" || status !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-zinc-400"
            onClick={() => { setBranch(""); setScanner("all"); setStatus("all"); setCursor(undefined); }}
          >
            Сбросить
          </Button>
        )}
      </div>

      {/* Таблица сканов */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сканы</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scansQuery.isLoading && (
            <p className="px-4 py-6 text-sm text-zinc-500">Загрузка…</p>
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
                {/* Статус */}
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`}
                  title={cfg.label}
                />
                {/* Время */}
                <span className="w-32 shrink-0 text-xs text-zinc-400">
                  {relTime(s.started_at)}
                </span>
                {/* Ветка */}
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
                  <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="truncate">{s.branch}</span>
                </span>
                {/* Коммит */}
                <span
                  className="w-20 shrink-0 cursor-copy font-mono text-xs text-zinc-400"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(s.commit_sha); }}
                  title="Скопировать полный SHA"
                >
                  {s.commit_sha.slice(0, 8)}
                </span>
                {/* Сканер */}
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${scannerBadgeClass(s.scanner)}`}
                >
                  {s.scanner}
                </span>
                {/* Счётчики */}
                <span className="w-20 shrink-0 text-right text-xs text-zinc-400">
                  +{s.findings_imported} / ~{s.findings_updated}
                </span>
                {/* CI link */}
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

      {/* Drawer с деталями скана */}
      {selectedScan && (
        <ScanDrawer scan={selectedScan} onClose={() => setSelectedScan(null)} />
      )}
    </div>
  );
}
