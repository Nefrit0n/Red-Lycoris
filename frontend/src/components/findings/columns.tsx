import type { ReactNode } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import { ru } from "date-fns/locale";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { severityMeta } from "@/lib/severity";
import type {
  ColumnKey,
  FindingsTabKey,
} from "@/components/findings/findingsTableConfig";
import {
  COLUMN_LABEL,
  COLUMN_WIDTH,
  COLUMN_WIDTH_PX,
  sanitizeColumns,
} from "@/components/findings/findingsTableConfig";
import { truncateMiddle } from "@/lib/string";
import { cn } from "@/lib/utils";
import type { Finding } from "@/types";

export interface FindingColumn {
  id: ColumnKey;
  header: string;
  widthClass: string;
  widthPx: number;
  Cell: (props: {
    finding: Finding;
    onPickProject?: (id: string) => void;
  }) => ReactNode;
  align?: "left" | "right";
}

function formatSeen(value: string | null | undefined): { text: string; title: string } {
  if (!value) return { text: "—", title: "—" };
  const d = new Date(value);
  if (!isValid(d)) return { text: "—", title: "—" };

  const absolute = format(d, "dd.MM.yyyy, HH:mm", { locale: ru });
  const relative = formatDistanceToNowStrict(d, { locale: ru });
  const hoursAgo = Math.max(1, Math.floor((Date.now() - d.getTime()) / 3_600_000));
  const daysAgo = Math.floor(hoursAgo / 24);
  let text = `${hoursAgo}ч`;
  if (daysAgo >= 1) text = `${daysAgo}д`;
  if (daysAgo > 7) text = format(d, "dd.MM", { locale: ru });

  return { text, title: `${absolute} • около ${relative} назад` };
}

function parseFixedVersions(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function copyToClipboard(value: string) {
  void navigator.clipboard?.writeText(value);
}

function stripCveFromTitle(title: string, cveIds: string[], activeColumns: Set<ColumnKey>): string {
  if (!activeColumns.has("cve")) return title;
  const known = cveIds.map((cve) => cve.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (known.length === 0) return title;
  const pattern = new RegExp(`\\s*(?:\\[)?(?:${known.join("|")})(?:\\])?\\s*$`, "i");
  return title.replace(pattern, "").trim();
}

const CWE_NAME: Record<number, string> = {
  79: "Improper Neutralization of Input During Web Page Generation (Cross-site Scripting)",
  89: "Improper Neutralization of Special Elements used in an SQL Command",
  22: "Improper Limitation of a Pathname to a Restricted Directory",
  352: "Cross-Site Request Forgery",
};

function FixCell({ finding }: { finding: Finding }) {
  const versions = parseFixedVersions(finding.fixed_version);
  if (versions.length === 0) return <span className="text-xs text-zinc-700">—</span>;

  const primary = versions[0];
  const hidden = versions.slice(1);

  const hiddenTooltip = (
    <div className="max-w-[240px] space-y-1">
      {versions.map((version) => (
        <div key={version} className="font-mono text-[11px]">{version}</div>
      ))}
    </div>
  );

  return (
    <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
      <span className="font-mono text-xs text-emerald-400">→ {primary}</span>
      {hidden.length > 0 && (
        <DropdownMenu>
          <Tooltip content={hiddenTooltip} side="right" align="start">
            <DropdownMenuTrigger className="inline-flex h-5 items-center rounded border border-emerald-600/60 bg-emerald-950/40 px-1.5 text-[11px] text-emerald-300">
              +{hidden.length}
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[220px]" align="start">
            {versions.map((version) => (
              <DropdownMenuItem key={version} className="justify-between gap-3" onClick={() => copyToClipboard(version)}>
                <span className="font-mono text-xs">{version}</span>
                <Copy className="size-3.5 text-zinc-500" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

const CELL_BY_KEY: Record<ColumnKey, FindingColumn> = {
  checkbox: {
    id: "checkbox",
    header: COLUMN_LABEL.checkbox,
    widthClass: COLUMN_WIDTH.checkbox,
    widthPx: COLUMN_WIDTH_PX.checkbox,
    Cell: () => null,
  },
  type: {
    id: "type",
    header: COLUMN_LABEL.type,
    widthClass: COLUMN_WIDTH.type,
    widthPx: COLUMN_WIDTH_PX.type,
    Cell: ({ finding }) => <KindBadge kind={finding.kind} iconOnly />,
  },
  name: {
    id: "name",
    header: COLUMN_LABEL.name,
    widthClass: COLUMN_WIDTH.name,
    widthPx: COLUMN_WIDTH_PX.name,
    Cell: ({ finding }) => (
      <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-zinc-200" title={finding.title || "Без названия"}>
        {finding.title || "Без названия"}
      </span>
    ),
  },
  component: {
    id: "component",
    header: COLUMN_LABEL.component,
    widthClass: COLUMN_WIDTH.component,
    widthPx: COLUMN_WIDTH_PX.component,
    Cell: ({ finding }) => {
      const full = finding.component
        ? `${finding.component}${finding.component_version ? `@${finding.component_version}` : ""}`
        : "";
      if (!full) return <span className="text-xs text-zinc-700">—</span>;
      return (
        <span
          className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-zinc-400"
          title={full}
          style={{ cursor: "help" }}
        >
          {truncateMiddle(full, 40)}
        </span>
      );
    },
  },
  file: {
    id: "file",
    header: COLUMN_LABEL.file,
    widthClass: COLUMN_WIDTH.file,
    widthPx: COLUMN_WIDTH_PX.file,
    Cell: ({ finding }) => {
      if (!finding.file_path) return <span className="text-xs text-zinc-700">—</span>;
      const full = `${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ""}`;
      return (
        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-zinc-500" title={full}>
          {full}
        </span>
      );
    },
  },
  rule: {
    id: "rule",
    header: COLUMN_LABEL.rule,
    widthClass: COLUMN_WIDTH.rule,
    widthPx: COLUMN_WIDTH_PX.rule,
    Cell: ({ finding }) =>
      finding.rule_id ? (
        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-zinc-400">{finding.rule_id}</span>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  secret_kind: {
    id: "secret_kind",
    header: COLUMN_LABEL.secret_kind,
    widthClass: COLUMN_WIDTH.secret_kind,
    widthPx: COLUMN_WIDTH_PX.secret_kind,
    Cell: ({ finding }) =>
      finding.secret_kind ? (
        <span className="inline-flex h-5 items-center rounded border border-amber-700/50 px-1.5 text-[10px] text-amber-300">
          {finding.secret_kind}
        </span>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  fix: {
    id: "fix",
    header: COLUMN_LABEL.fix,
    widthClass: COLUMN_WIDTH.fix,
    widthPx: COLUMN_WIDTH_PX.fix,
    Cell: ({ finding }) => <FixCell finding={finding} />, 
  },
  enrichment: {
    id: "enrichment",
    header: COLUMN_LABEL.enrichment,
    widthClass: COLUMN_WIDTH.enrichment,
    widthPx: COLUMN_WIDTH_PX.enrichment,
    Cell: ({ finding }) => (
      <EnrichmentBadges
        inKev={finding.in_kev}
        inBdu={finding.in_bdu}
        maxEpss={finding.max_epss}
        maxCvss={finding.max_cvss}
        fixedVersion={finding.fixed_version}
        cweIds={finding.cwe_ids}
        activeColumns={new Set<ColumnKey>()}
      />
    ),
  },
  cve: {
    id: "cve",
    header: COLUMN_LABEL.cve,
    widthClass: COLUMN_WIDTH.cve,
    widthPx: COLUMN_WIDTH_PX.cve,
    Cell: ({ finding }) => {
      const cve = finding.cve_ids[0];
      if (!cve) return <span className="text-xs text-zinc-700">—</span>;
      const url = `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;
      return (
        <div className="flex min-w-0 items-center gap-1">
          <a href={url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-zinc-300 hover:text-zinc-100" title={finding.cve_ids.join(", ")}>
            {cve}
          </a>
          <button type="button" onClick={() => copyToClipboard(cve)} className="text-zinc-500 hover:text-zinc-300" aria-label="Copy CVE">
            <Copy className="size-3.5" />
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300" aria-label="Open CVE">
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      );
    },
  },
  cwe: {
    id: "cwe",
    header: COLUMN_LABEL.cwe,
    widthClass: COLUMN_WIDTH.cwe,
    widthPx: COLUMN_WIDTH_PX.cwe,
    Cell: ({ finding }) => {
      if (finding.cwe_ids.length === 0) return <span className="text-xs text-zinc-700">—</span>;
      const cweId = finding.cwe_ids[0];
      const cweLabel = `CWE-${cweId}`;
      const tooltip = CWE_NAME[cweId] ?? `Common Weakness Enumeration #${cweId}`;
      return (
        <Tooltip content={tooltip}>
          <span className="inline-flex h-5 items-center rounded border border-zinc-600 px-1.5 text-[11px] text-zinc-300">{cweLabel}</span>
        </Tooltip>
      );
    },
  },
  bdu: {
    id: "bdu",
    header: COLUMN_LABEL.bdu,
    widthClass: COLUMN_WIDTH.bdu,
    widthPx: COLUMN_WIDTH_PX.bdu,
    Cell: ({ finding }) =>
      finding.in_bdu ? (
        <a
          href={`https://bdu.fstec.ru/vul?search=${encodeURIComponent(finding.cve_ids[0] ?? finding.title)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-5 items-center rounded border border-sky-500/70 px-1.5 text-[11px] text-sky-300 hover:bg-sky-950/30"
        >
          БДУ
        </a>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  kev: {
    id: "kev",
    header: COLUMN_LABEL.kev,
    widthClass: COLUMN_WIDTH.kev,
    widthPx: COLUMN_WIDTH_PX.kev,
    Cell: ({ finding }) =>
      finding.in_kev ? (
        <span className="inline-flex h-5 items-center rounded border border-red-600 bg-red-600 px-1.5 text-[11px] text-white">🔥</span>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  cvss: {
    id: "cvss",
    header: COLUMN_LABEL.cvss,
    widthClass: COLUMN_WIDTH.cvss,
    widthPx: COLUMN_WIDTH_PX.cvss,
    align: "right",
    Cell: ({ finding }) => (
      <span className="text-xs text-zinc-400">
        {typeof finding.max_cvss === "number" ? finding.max_cvss.toFixed(1) : "—"}
      </span>
    ),
  },
  epss: {
    id: "epss",
    header: COLUMN_LABEL.epss,
    widthClass: COLUMN_WIDTH.epss,
    widthPx: COLUMN_WIDTH_PX.epss,
    align: "right",
    Cell: ({ finding }) => (
      <span className="font-mono text-xs text-zinc-400">
        {typeof finding.max_epss === "number" ? `${(finding.max_epss * 100).toFixed(1)}%` : "—"}
      </span>
    ),
  },
  severity: {
    id: "severity",
    header: COLUMN_LABEL.severity,
    widthClass: COLUMN_WIDTH.severity,
    widthPx: COLUMN_WIDTH_PX.severity,
    Cell: ({ finding }) => {
      const meta = severityMeta(finding.severity);
      return (
        <span className={cn("inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-medium", meta.badgeClass)}>
          {meta.label}
        </span>
      );
    },
  },
  project: {
    id: "project",
    header: COLUMN_LABEL.project,
    widthClass: COLUMN_WIDTH.project,
    widthPx: COLUMN_WIDTH_PX.project,
    Cell: ({ finding, onPickProject }) => (
      <ProjectPill id={finding.project_id} name={finding.project_name} onPick={onPickProject} />
    ),
  },
  detected: {
    id: "detected",
    header: COLUMN_LABEL.detected,
    widthClass: COLUMN_WIDTH.detected,
    widthPx: COLUMN_WIDTH_PX.detected,
    align: "right",
    Cell: ({ finding }) => {
      const seen = formatSeen(finding.first_seen);
      return (
        <span className="text-right text-xs text-zinc-500" title={seen.title}>
          {seen.text}
        </span>
      );
    },
  },
  status: {
    id: "status",
    header: COLUMN_LABEL.status,
    widthClass: COLUMN_WIDTH.status,
    widthPx: COLUMN_WIDTH_PX.status,
    Cell: ({ finding }) => (
      <span className="text-xs text-zinc-400">{finding.status === 0 ? "Открыта" : "Изменена"}</span>
    ),
  },
  first_seen: {
    id: "first_seen",
    header: COLUMN_LABEL.first_seen,
    widthClass: COLUMN_WIDTH.first_seen,
    widthPx: COLUMN_WIDTH_PX.first_seen,
    Cell: ({ finding }) => <span className="text-xs text-zinc-500">{formatSeen(finding.first_seen).text}</span>,
  },
  last_seen: {
    id: "last_seen",
    header: COLUMN_LABEL.last_seen,
    widthClass: COLUMN_WIDTH.last_seen,
    widthPx: COLUMN_WIDTH_PX.last_seen,
    Cell: ({ finding }) => <span className="text-xs text-zinc-500">{formatSeen(finding.last_seen).text}</span>,
  },
};

export function getColumnsForKeys(tab: FindingsTabKey, columnKeys: ColumnKey[]): FindingColumn[] {
  const sanitized = sanitizeColumns(tab, columnKeys);
  const activeSet = new Set(sanitized);

  return sanitized
    .filter((key) => key !== "checkbox")
    .map((key) => {
      const base = CELL_BY_KEY[key];

      if (key === "name") {
        return {
          ...base,
          Cell: ({ finding }) => {
            const rawTitle = finding.title || "Без названия";
            const clean = stripCveFromTitle(rawTitle, finding.cve_ids, activeSet);
            return (
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-zinc-200" title={rawTitle}>
                {clean || rawTitle}
              </span>
            );
          },
        };
      }

      if (key === "enrichment") {
        return {
          ...base,
          Cell: ({ finding }) => (
            <EnrichmentBadges
              inKev={finding.in_kev}
              inBdu={finding.in_bdu}
              maxEpss={finding.max_epss}
              maxCvss={finding.max_cvss}
              fixedVersion={finding.fixed_version}
              cweIds={finding.cwe_ids}
              activeColumns={activeSet}
            />
          ),
        };
      }

      return base;
    });
}
