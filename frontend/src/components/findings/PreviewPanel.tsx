import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  GitCommit,
  Loader2,
  ChevronUp,
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
  currentIndex?: number | null;
  totalCount?: number;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

const STATUS_OPTIONS = [
  { value: 0, label: "Открыта" },
  { value: 1, label: "Подтверждена" },
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
        cweIds={finding.cwe_ids}
      />
    </div>
  );
}

function copyValue(value: string) {
  void navigator.clipboard?.writeText(value);
}

function KeyMetaBlock({ finding }: { finding: Finding }) {
  const rows: Array<{
    key: string;
    value: string;
    copyable?: boolean;
  }> = [
    { key: "Fixed version", value: finding.fixed_version || "—", copyable: !!finding.fixed_version },
    { key: "Status", value: statusMeta(finding.status).label },
    { key: "Class", value: finding.rule_name || "—" },
    { key: "Type", value: finding.kind.toUpperCase() },
    { key: "Artifact", value: finding.component || finding.file_path || "—", copyable: !!(finding.component || finding.file_path) },
    { key: "CVE", value: finding.cve_ids.length ? finding.cve_ids.join(", ") : "—", copyable: finding.cve_ids.length > 0 },
    { key: "CWE", value: finding.cwe_ids.length ? finding.cwe_ids.map((id) => `CWE-${id}`).join(", ") : "—", copyable: finding.cwe_ids.length > 0 },
    { key: "CVSS", value: typeof finding.max_cvss === "number" ? finding.max_cvss.toFixed(1) : "—" },
    { key: "EPSS", value: typeof finding.max_epss === "number" ? `${(finding.max_epss * 100).toFixed(1)}%` : "—" },
  ];

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
      <SectionTitle>Ключевые метаданные</SectionTitle>
      <div className="mt-2 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <div className="text-zinc-500">{row.key}</div>
            <div className="flex min-w-0 items-start gap-1.5 text-zinc-200">
              <span className="min-w-0 break-words font-mono text-xs">{row.value}</span>
              {row.copyable && row.value !== "—" && (
                <button
                  type="button"
                  aria-label={`Скопировать ${row.key}`}
                  onClick={() => copyValue(row.value)}
                  className="mt-0.5 shrink-0 text-zinc-500 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600/70"
                >
                  <Copy className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
        <div className="text-zinc-500">Впервые</div>
        <div className="text-zinc-300" title={formatAbsolute(finding.first_seen)}>
          {formatRelative(finding.first_seen)}
        </div>
        <div className="text-zinc-500">Последний раз</div>
        <div className="text-zinc-300" title={formatAbsolute(finding.last_seen)}>
          {formatRelative(finding.last_seen)}
        </div>
      </div>
    </div>
  );
}

function DescriptionBlock({ finding }: { finding: Finding }) {
  if (!finding.description) return null;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
      <SectionTitle>Описание</SectionTitle>
      <div className="prose prose-invert prose-sm mt-2 max-w-none leading-relaxed text-zinc-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {finding.description}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function ExternalLinksBlock({ finding }: { finding: Finding }) {
  const links: Array<{ label: string; href: string }> = [];
  finding.cve_ids.forEach((cve) =>
    links.push({ label: cve, href: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}` }),
  );
  if (finding.purl) {
    links.push({ label: "Package URL", href: `https://osv.dev/list?ecosystem=&q=${encodeURIComponent(finding.purl)}` });
  }
  if (finding.rule_id) {
    links.push({ label: `Rule ${finding.rule_id}`, href: `https://github.com/search?q=${encodeURIComponent(finding.rule_id)}` });
  }

  if (links.length === 0) return null;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
      <SectionTitle>Внешние ссылки</SectionTitle>
      <div className="mt-2 space-y-1.5">
        {links.map((link) => (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-100"
          >
            <ExternalLink className="size-3.5 text-zinc-500" />
            <span className="truncate">{link.label}</span>
          </a>
        ))}
      </div>
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
  currentIndex = null,
  totalCount = 0,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
}: PreviewPanelProps) {
  const { data, isLoading, isError, error } = useFinding(findingId ?? "");
  const updateStatus = useUpdateStatus();
  const finding = data?.data.finding;
  const [statusError, setStatusError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [fadeIn, setFadeIn] = useState(true);

  // Focus management: when opening, pull focus into the panel so keyboard
  // shortcuts land there and the ring stays visible. Using a ref + effect
  // rather than autofocus so the panel doesn't steal focus on re-renders.
  useEffect(() => {
    if (!findingId) return;
    const node = document.getElementById("findings-preview-panel");
    node?.focus();
  }, [findingId]);

  useEffect(() => {
    if (!findingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findingId, onClose]);

  useEffect(() => {
    if (!findingId) return;
    const panel = document.getElementById("findings-preview-panel");
    if (!panel) return;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((node) => !node.hasAttribute("disabled"));
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [findingId]);


  useEffect(() => {
    setFadeIn(false);
    const t = window.setTimeout(() => setFadeIn(true), 30);
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    return () => window.clearTimeout(t);
  }, [findingId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editable = !!target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
      if (editable) return;
      if ((event.key === "j" || event.key === "ArrowDown") && canNext) {
        event.preventDefault();
        onNext?.();
      }
      if ((event.key === "k" || event.key === "ArrowUp") && canPrev) {
        event.preventDefault();
        onPrev?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canNext, canPrev, onNext, onPrev]);
  if (!findingId) {
    return null;
  }

  const handleStatusChange = (status: number) => {
    if (!finding || updateStatus.isPending || finding.status === status) {
      return;
    }
    setStatusError(null);
    updateStatus.mutate(
      { id: finding.id, status },
      {
        onError: (e) => {
          setStatusError(
            e instanceof Error ? e.message : "Не удалось изменить статус",
          );
        },
      },
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть предпросмотр"
        className="fixed inset-0 z-40 cursor-default bg-black/40 opacity-100 animate-in fade-in duration-150"
        onClick={onClose}
      />
      <aside
        id="findings-preview-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="findings-preview-title"
        className={cn(
          "fixed right-0 top-14 bottom-0 z-[60] flex w-[min(560px,40vw)] max-w-[90vw] flex-col border-l border-zinc-800 bg-zinc-950/95",
          "outline-none animate-in slide-in-from-right-full duration-200 ease-out",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div
              id="findings-preview-title"
              className="max-h-[4.5rem] overflow-hidden text-sm font-semibold leading-snug text-zinc-100"
            >
              {finding?.title ?? "Загрузка…"}
            </div>
            {finding && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                {finding.fixed_version && (
                  <span className="rounded-md border border-emerald-700/50 px-2 py-0.5 text-xs text-emerald-300">
                    Fix {finding.fixed_version}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canPrev}
              onClick={onPrev}
              className="text-zinc-400 hover:text-zinc-200"
              aria-label="Предыдущая находка"
            >
              <ChevronUp className="size-4" />
            </Button>
            <span className="min-w-[52px] text-center text-xs text-zinc-500">
              {currentIndex ? `${currentIndex} / ${totalCount}` : `— / ${totalCount}`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canNext}
              onClick={onNext}
              className="text-zinc-400 hover:text-zinc-200"
              aria-label="Следующая находка"
            >
              <ChevronDown className="size-4" />
            </Button>
            {finding && (
              <Button
                render={
                  <Link
                    to={`/findings/${finding.id}`}
                    aria-label="Открыть полностью"
                    target="_blank"
                    rel="noreferrer"
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
          </div>
        </header>

        <div ref={bodyRef} className={cn("themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 transition-opacity duration-150", fadeIn ? "opacity-100" : "opacity-0")}>
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
              <span className="sr-only" role="status" aria-live="polite">
                Открыто: детали уязвимости {finding.title}
              </span>
              <PreviewHeader finding={finding} onPickProject={onPickProject} />
              <KeyMetaBlock finding={finding} />
              <KindPreviewBody finding={finding} />
              <DescriptionBlock finding={finding} />
              <ExternalLinksBlock finding={finding} />
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
          <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
            <Button
              render={
                <Link
                  to={`/findings/${finding.id}`}
                  aria-label="Открыть детали"
                  target="_blank"
                  rel="noreferrer"
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
                className="z-[70] border-zinc-700 bg-zinc-900"
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
            {statusError ? (
              <div className="ml-2 max-w-[220px] text-xs text-red-300">
                {statusError}
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </>
  );
}

export default PreviewPanel;
