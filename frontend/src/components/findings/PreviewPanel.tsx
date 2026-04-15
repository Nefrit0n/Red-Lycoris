import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronDown,
  ExternalLink,
  GitCommit,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CodeSnippet from "@/components/CodeSnippet";
import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { useFinding, useUpdateStatus } from "@/api/findings";
import { statusMeta } from "@/lib/severity";
import type { Finding } from "@/types";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  findingId: string | null;
  onClose: () => void;
  onPickProject?: (projectId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 0, label: "Открыта" },
  { value: 1, label: "Подтверждена" },
  { value: 2, label: "Ложное срабатывание" },
  { value: 3, label: "Устранена" },
  { value: 4, label: "Риск принят" },
];

function formatAbsolute(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!isValid(d)) return "—";
  return format(d, "d MMMM yyyy, HH:mm", { locale: ru });
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right text-zinc-200">
        {children}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </div>
  );
}

// Shared header block: kind + severity + status + project + enrichment badges.
// Kind-specific previews compose this on top and focus their body on the
// details that vary by finding kind.
function PreviewHeader({
  finding,
  onPickProject,
}: {
  finding: Finding;
  onPickProject?: (projectId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <KindBadge kind={finding.kind} />
        <span
          className={cn(
            "inline-block rounded-md border px-2 py-0.5 text-xs",
            statusMeta(finding.status).badgeClass,
          )}
        >
          {statusMeta(finding.status).label}
        </span>
        {finding.project_name && (
          <ProjectPill
            id={finding.project_id}
            name={finding.project_name}
            onPick={onPickProject}
          />
        )}
      </div>

      <EnrichmentBadges
        inKev={finding.in_kev}
        inBdu={finding.in_bdu}
        maxEpss={finding.max_epss}
        maxCvss={finding.max_cvss}
        fixedVersion={finding.fixed_version}
      />

      {finding.description && (
        <div className="whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
          {finding.description}
        </div>
      )}
    </div>
  );
}

// CommonMetaBlock — the "always-show" timestamps + priority. Every preview
// shows these below the kind-specific body so a user can anchor on recency
// and relative importance regardless of finding kind.
function CommonMetaBlock({ finding }: { finding: Finding }) {
  return (
    <div className="divide-y divide-zinc-900 rounded-md border border-zinc-800 bg-zinc-900/30 px-3">
      {finding.cve_ids.length > 0 && (
        <MetaRow label="CVE">
          <span className="font-mono text-xs">
            {finding.cve_ids.join(", ")}
          </span>
        </MetaRow>
      )}
      {finding.cwe_ids.length > 0 && (
        <MetaRow label="CWE">
          <span className="font-mono text-xs">
            {finding.cwe_ids.map((id) => `CWE-${id}`).join(", ")}
          </span>
        </MetaRow>
      )}
      <MetaRow label="Впервые">
        <span title={formatAbsolute(finding.first_seen)}>
          {formatRelative(finding.first_seen)}
        </span>
      </MetaRow>
      <MetaRow label="Последний раз">
        <span title={formatAbsolute(finding.last_seen)}>
          {formatRelative(finding.last_seen)}
        </span>
      </MetaRow>
      <MetaRow label="Замечено раз">
        <span>{finding.times_seen}</span>
      </MetaRow>
      {typeof finding.priority_score === "number" && (
        <MetaRow label="Приоритет">
          <span className="tabular-nums">
            {finding.priority_score.toFixed(1)}
          </span>
        </MetaRow>
      )}
    </div>
  );
}

// SCA preview: lead with the vulnerable component/version and the suggested
// fix version. Anything the user cares about for an SBOM-level triage goes
// above the fold.
function SCAPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <SectionTitle>Компонент</SectionTitle>
        <div className="mt-1 break-all font-mono text-sm text-zinc-200">
          {finding.component || "—"}
          {finding.component_version && (
            <span className="ml-1 text-zinc-500">
              @{finding.component_version}
            </span>
          )}
        </div>
        {finding.fixed_version && (
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <span className="text-zinc-500">Исправлено в:</span>
            <span className="rounded bg-emerald-950/40 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
              {finding.fixed_version}
            </span>
          </div>
        )}
        {finding.package_ecosystem && (
          <div className="mt-1 text-xs text-zinc-500">
            Экосистема: <span className="text-zinc-300">{finding.package_ecosystem}</span>
          </div>
        )}
        {finding.purl && (
          <div className="mt-1 break-all font-mono text-[11px] text-zinc-600">
            {finding.purl}
          </div>
        )}
      </div>
    </div>
  );
}

// SAST preview: lead with the file location + rule id, then code snippet.
function SASTPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <SectionTitle>Расположение</SectionTitle>
        <div className="mt-1 break-all font-mono text-sm text-zinc-200">
          {finding.file_path || "—"}
          {finding.line_start ? (
            <span className="text-zinc-500">
              :{finding.line_start}
              {finding.line_end && finding.line_end !== finding.line_start
                ? `-${finding.line_end}`
                : ""}
            </span>
          ) : null}
        </div>
        {finding.rule_id && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Правило:</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
              {finding.rule_id}
            </span>
            {finding.rule_name && (
              <span className="truncate text-xs text-zinc-400">
                {finding.rule_name}
              </span>
            )}
          </div>
        )}
      </div>

      {finding.code_snippet && (
        <div className="space-y-1.5">
          <SectionTitle>Фрагмент кода</SectionTitle>
          <CodeSnippet
            code={finding.code_snippet}
            filePath={finding.file_path}
            highlightLine={finding.line_start}
            startLine={finding.line_start ?? 1}
            maxHeight={240}
          />
        </div>
      )}
    </div>
  );
}

// DAST preview: URL + method + parameter, compactly displayed.
function DASTPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <SectionTitle>Запрос</SectionTitle>
        <div className="mt-1 flex items-start gap-2">
          {finding.http_method && (
            <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-300">
              {finding.http_method}
            </span>
          )}
          <span className="min-w-0 break-all font-mono text-sm text-zinc-200">
            {finding.url || "—"}
          </span>
        </div>
        {finding.http_param && (
          <div className="mt-2 text-sm">
            <span className="text-zinc-500">Параметр: </span>
            <span className="font-mono text-xs text-zinc-200">
              {finding.http_param}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// IaC preview: resource + provider + file.
function IaCPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <SectionTitle>Ресурс</SectionTitle>
        <div className="mt-1 flex items-start gap-2">
          {finding.iac_provider && (
            <span className="rounded border border-teal-700/50 bg-teal-950/40 px-1.5 py-0.5 text-[11px] text-teal-300">
              {finding.iac_provider}
            </span>
          )}
          <span className="min-w-0 break-all font-mono text-sm text-zinc-200">
            {finding.iac_resource || "—"}
          </span>
        </div>
        {finding.file_path && (
          <div className="mt-2 break-all font-mono text-xs text-zinc-500">
            {finding.file_path}
            {finding.line_start ? `:${finding.line_start}` : ""}
          </div>
        )}
      </div>

      {finding.code_snippet && (
        <div className="space-y-1.5">
          <SectionTitle>Фрагмент конфигурации</SectionTitle>
          <CodeSnippet
            code={finding.code_snippet}
            filePath={finding.file_path}
            highlightLine={finding.line_start}
            startLine={finding.line_start ?? 1}
            maxHeight={240}
          />
        </div>
      )}
    </div>
  );
}

// Secrets preview: kind + redacted location + commit.
function SecretsPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <SectionTitle>Тип секрета</SectionTitle>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
          {finding.secret_kind ? (
            <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-300">
              {finding.secret_kind}
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </div>
        {finding.file_path && (
          <div className="mt-2 break-all font-mono text-xs text-zinc-500">
            {finding.file_path}
            {finding.line_start ? `:${finding.line_start}` : ""}
          </div>
        )}
        {finding.commit_sha && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <GitCommit className="size-3" />
            <span className="font-mono text-zinc-300">
              {finding.commit_sha.slice(0, 10)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// GenericPreview — fallback for unknown kinds. Shows the metadata we always
// have so the user still has something useful to scan.
function GenericPreview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-400">
        Подробности без привязки к типу. Используйте «Открыть детали» для
        полного обзора.
        {finding.file_path && (
          <div className="mt-2 break-all font-mono text-xs text-zinc-500">
            {finding.file_path}
            {finding.line_start ? `:${finding.line_start}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// Kind dispatcher — keeps the main component body short and makes it obvious
// where each kind's layout lives.
function KindPreviewBody({ finding }: { finding: Finding }) {
  switch (finding.kind) {
    case "sca":
      return <SCAPreview finding={finding} />;
    case "sast":
      return <SASTPreview finding={finding} />;
    case "dast":
      return <DASTPreview finding={finding} />;
    case "iac":
      return <IaCPreview finding={finding} />;
    case "secrets":
      return <SecretsPreview finding={finding} />;
    default:
      return <GenericPreview finding={finding} />;
  }
}

// PreviewPanel slides in from the right and shows enough context to triage a
// finding without a full page navigation. It still links to the full detail
// page so power users can dig deeper. Esc closing is handled by the parent
// (FindingsList) so the same shortcut can fall back to clearing selection.
export function PreviewPanel({
  findingId,
  onClose,
  onPickProject,
}: PreviewPanelProps) {
  const { data, isLoading, isError, error } = useFinding(findingId ?? "");
  const navigate = useNavigate();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const updateStatus = useUpdateStatus();
  const reopenFinding = useReopenFinding();
  const finding = data?.data.finding;


  // Focus management: when opening, pull focus into the panel so keyboard
  // shortcuts land there and the ring stays visible. Using a ref + effect
  // rather than autofocus so the panel doesn't steal focus on re-renders.
  useEffect(() => {
    if (!findingId) return;
    const node = document.getElementById("findings-preview-panel");
    node?.focus();
  }, [findingId]);

  if (!findingId) {
    return null;
  }

  const handleStatusChange = (status: number) => {
    if (!finding || updateStatus.isPending || finding.status === status) {
      return;
    }
    updateStatus.mutate({ id: finding.id, status });
  };

  return (
    <aside
      id="findings-preview-panel"
      tabIndex={-1}
      className={cn(
        // Slide-in animation: translates from the right into place on mount.
        // The data-[state] attribute reacts to the findingId prop so future
        // exit animations can hook the same selector.
        "flex w-[420px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/60",
        "outline-none animate-in slide-in-from-right-8 duration-200",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Предпросмотр
          </div>
          <div className="truncate text-sm font-medium text-zinc-200">
            {finding?.title ?? "Загрузка…"}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {finding && (
            <Button
              render={
                <Link
                  to={`/findings/${finding.id}`}
                  aria-label="Открыть полностью"
                />
              }
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-zinc-200"
            >
              <ExternalLink className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
            aria-label="Закрыть предпросмотр"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full bg-zinc-800/40" />
            <Skeleton className="h-4 w-2/3 bg-zinc-800/40" />
            <Skeleton className="h-24 w-full bg-zinc-800/40" />
            <Skeleton className="h-32 w-full bg-zinc-800/40" />
          </div>
        )}

        {isError && (
          <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
            Не удалось загрузить находку:{" "}
            {error instanceof Error ? error.message : "неизвестная ошибка"}
          </div>
        )}

        {finding && (
          <div className="space-y-4">
            <PreviewHeader finding={finding} onPickProject={onPickProject} />
            <KindPreviewBody finding={finding} />
            <CommonMetaBlock finding={finding} />
          </div>
        )}

        {!finding && !isLoading && !isError && (
          <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Загрузка…
          </div>
        )}
      </div>

      {/* Bottom action bar — only shown when the finding payload is loaded.
        Kept outside the scroll container so the actions stay reachable even
        for long descriptions or code snippets. */}
      {finding && (
        <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950/80 px-4 py-3">
          <Button
            render={
              <Link
                to={`/findings/${finding.id}`}
                aria-label="Открыть детали"
              />
            }
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            Открыть детали
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateStatus.isPending}
                  className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Сменить статус
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent
              align="start"
              className="border-zinc-700 bg-zinc-900"
            >
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  disabled={
                    updateStatus.isPending || opt.value === finding.status
                  }
                  onClick={() => handleStatusChange(opt.value)}
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignment is intentionally disabled for now — the feature
            shell is part of the redesign but the backend contract isn't
            finalised yet. Kept visible so the affordance doesn't appear
            only later and break muscle memory. */}
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="ml-auto text-zinc-500"
          >
            Назначить
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      )}
    </aside>
  );
}

export default PreviewPanel;
