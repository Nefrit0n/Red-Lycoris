import { useEffect } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { ExternalLink, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CodeSnippet from "@/components/CodeSnippet";
import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { useFinding } from "@/api/findings";
import { statusMeta } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  findingId: string | null;
  onClose: () => void;
  onPickProject?: (projectId: string) => void;
}

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

  return (
    <aside
      id="findings-preview-panel"
      tabIndex={-1}
      className={cn(
        "flex w-[420px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/60",
        "outline-none",
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

            <div className="divide-y divide-zinc-900 rounded-md border border-zinc-800 bg-zinc-900/30 px-3">
              {finding.file_path && (
                <MetaRow label="Файл">
                  <span className="font-mono text-xs">
                    {finding.file_path}
                    {finding.line_start ? `:${finding.line_start}` : ""}
                  </span>
                </MetaRow>
              )}
              {finding.component && (
                <MetaRow label="Компонент">
                  <span className="font-mono text-xs">
                    {finding.component}
                    {finding.component_version
                      ? `@${finding.component_version}`
                      : ""}
                  </span>
                </MetaRow>
              )}
              {finding.rule_id && (
                <MetaRow label="Правило">
                  <span className="font-mono text-xs">
                    {finding.rule_id}
                  </span>
                </MetaRow>
              )}
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

            {finding.code_snippet && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Фрагмент кода
                </div>
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
        )}

        {!finding && !isLoading && !isError && (
          <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Загрузка…
          </div>
        )}
      </div>
    </aside>
  );
}

export default PreviewPanel;
