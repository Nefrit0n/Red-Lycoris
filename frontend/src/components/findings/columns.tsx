import type { ReactNode } from "react";
import {
  format,
  formatDistanceToNowStrict,
  isValid,
} from "date-fns";
import { ru } from "date-fns/locale";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import SeverityBadge from "@/components/findings/SeverityBadge";
import type {
  ColumnKey,
  FindingsTabKey,
} from "@/components/findings/findingsTableConfig";
import {
  COLUMN_LABEL,
  COLUMN_WIDTH,
  sanitizeColumns,
} from "@/components/findings/findingsTableConfig";
import { truncateMiddle } from "@/lib/string";
import type { Finding } from "@/types";

export interface FindingColumn {
  id: ColumnKey;
  header: string;
  widthClass: string;
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

const CELL_BY_KEY: Record<ColumnKey, FindingColumn> = {
  checkbox: {
    id: "checkbox",
    header: COLUMN_LABEL.checkbox,
    widthClass: COLUMN_WIDTH.checkbox,
    Cell: () => null,
  },
  type: {
    id: "type",
    header: COLUMN_LABEL.type,
    widthClass: COLUMN_WIDTH.type,
    Cell: ({ finding }) => <KindBadge kind={finding.kind} iconOnly />,
  },
  name: {
    id: "name",
    header: COLUMN_LABEL.name,
    widthClass: COLUMN_WIDTH.name,
    Cell: ({ finding }) => (
      <span className="truncate text-sm text-zinc-200" title={finding.title || "Без названия"}>
        {finding.title || "Без названия"}
      </span>
    ),
  },
  component: {
    id: "component",
    header: COLUMN_LABEL.component,
    widthClass: COLUMN_WIDTH.component,
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
          {truncateMiddle(full, 38)}
        </span>
      );
    },
  },
  file: {
    id: "file",
    header: COLUMN_LABEL.file,
    widthClass: COLUMN_WIDTH.file,
    Cell: ({ finding }) => {
      if (!finding.file_path) return <span className="text-xs text-zinc-700">—</span>;
      const full = `${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ""}`;
      return (
        <span className="block w-full truncate font-mono text-xs text-zinc-500" title={full}>
          {full}
        </span>
      );
    },
  },
  rule: {
    id: "rule",
    header: COLUMN_LABEL.rule,
    widthClass: COLUMN_WIDTH.rule,
    Cell: ({ finding }) =>
      finding.rule_id ? (
        <span className="truncate font-mono text-xs text-zinc-400">{finding.rule_id}</span>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  secret_kind: {
    id: "secret_kind",
    header: COLUMN_LABEL.secret_kind,
    widthClass: COLUMN_WIDTH.secret_kind,
    Cell: ({ finding }) =>
      finding.secret_kind ? (
        <span className="rounded border border-amber-700/50 px-1.5 py-0.5 text-[10px] text-amber-300">
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
    Cell: ({ finding }) =>
      finding.fixed_version ? (
        <span className="font-mono text-xs text-emerald-400">{finding.fixed_version}</span>
      ) : (
        <span className="text-xs text-zinc-700">—</span>
      ),
  },
  enrichment: {
    id: "enrichment",
    header: COLUMN_LABEL.enrichment,
    widthClass: COLUMN_WIDTH.enrichment,
    Cell: ({ finding }) => (
      <EnrichmentBadges
        inKev={finding.in_kev}
        inBdu={finding.in_bdu}
        maxEpss={finding.max_epss}
        maxCvss={finding.max_cvss}
        fixedVersion={finding.fixed_version}
        cweIds={finding.cwe_ids}
      />
    ),
  },
  cve: {
    id: "cve",
    header: COLUMN_LABEL.cve,
    widthClass: COLUMN_WIDTH.cve,
    Cell: ({ finding }) => (
      <span className="truncate font-mono text-xs text-zinc-400" title={finding.cve_ids.join(", ")}>
        {finding.cve_ids[0] ?? "—"}
      </span>
    ),
  },
  cwe: {
    id: "cwe",
    header: COLUMN_LABEL.cwe,
    widthClass: COLUMN_WIDTH.cwe,
    Cell: ({ finding }) => (
      <span className="truncate text-xs text-zinc-400">
        {finding.cwe_ids.length > 0 ? `CWE-${finding.cwe_ids[0]}` : "—"}
      </span>
    ),
  },
  bdu: {
    id: "bdu",
    header: COLUMN_LABEL.bdu,
    widthClass: COLUMN_WIDTH.bdu,
    Cell: ({ finding }) => (
      <span className={finding.in_bdu ? "text-xs text-sky-300" : "text-xs text-zinc-700"}>
        {finding.in_bdu ? "Есть" : "—"}
      </span>
    ),
  },
  kev: {
    id: "kev",
    header: COLUMN_LABEL.kev,
    widthClass: COLUMN_WIDTH.kev,
    Cell: ({ finding }) => (
      <span className={finding.in_kev ? "text-xs text-red-300" : "text-xs text-zinc-700"}>
        {finding.in_kev ? "🔥 KEV" : "—"}
      </span>
    ),
  },
  cvss: {
    id: "cvss",
    header: COLUMN_LABEL.cvss,
    widthClass: COLUMN_WIDTH.cvss,
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
    Cell: ({ finding }) => <SeverityBadge severity={finding.severity} short />,
  },
  project: {
    id: "project",
    header: COLUMN_LABEL.project,
    widthClass: COLUMN_WIDTH.project,
    Cell: ({ finding, onPickProject }) => (
      <ProjectPill id={finding.project_id} name={finding.project_name} onPick={onPickProject} />
    ),
  },
  detected: {
    id: "detected",
    header: COLUMN_LABEL.detected,
    widthClass: COLUMN_WIDTH.detected,
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
    Cell: ({ finding }) => (
      <span className="text-xs text-zinc-400">{finding.status === 0 ? "Открыта" : "Изменена"}</span>
    ),
  },
  first_seen: {
    id: "first_seen",
    header: COLUMN_LABEL.first_seen,
    widthClass: COLUMN_WIDTH.first_seen,
    Cell: ({ finding }) => <span className="text-xs text-zinc-500">{formatSeen(finding.first_seen).text}</span>,
  },
  last_seen: {
    id: "last_seen",
    header: COLUMN_LABEL.last_seen,
    widthClass: COLUMN_WIDTH.last_seen,
    Cell: ({ finding }) => <span className="text-xs text-zinc-500">{formatSeen(finding.last_seen).text}</span>,
  },
};

export function getColumnsForKeys(tab: FindingsTabKey, columnKeys: ColumnKey[]): FindingColumn[] {
  return sanitizeColumns(tab, columnKeys)
    .filter((key) => key !== "checkbox")
    .map((key) => CELL_BY_KEY[key]);
}
