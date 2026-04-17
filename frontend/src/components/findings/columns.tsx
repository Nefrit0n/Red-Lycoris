import {
  format,
  formatDistanceToNow,
  formatDistanceToNowStrict,
  isValid,
} from "date-fns";
import { ru } from "date-fns/locale";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import type { Finding, FindingKind } from "@/types";
import type { Density } from "@/components/findings/FindingsToolbar";

export interface FindingColumn {
  id: string;
  header: string;
  widthClass: string;
  responsiveClass?: string;
  Cell: (props: {
    finding: Finding;
    density?: Density;
    onPickProject?: (id: string) => void;
  }) => React.ReactNode;
  align?: "left" | "right";
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

function formatSeenForDensity(
  value: string | null | undefined,
  density: Density | undefined,
): { text: string; title: string } {
  if (!value) return { text: "—", title: "—" };
  const d = new Date(value);
  if (!isValid(d)) return { text: "—", title: "—" };

  const relative = formatDistanceToNowStrict(d, { locale: ru });
  const absolute = format(d, "dd.MM.yyyy, HH:mm", { locale: ru });

  if (density === "spacious") {
    return { text: formatRelative(value), title: `${absolute} • ${relative}` };
  }

  const hoursAgo = Math.max(
    1,
    Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60)),
  );
  const daysAgo = Math.floor(hoursAgo / 24);

  let text: string;
  if (daysAgo > 7) {
    text = format(d, "dd.MM", { locale: ru });
  } else if (daysAgo >= 7) {
    text = "1нед";
  } else if (daysAgo >= 1) {
    text = `${daysAgo}д`;
  } else {
    text = `${hoursAgo}ч`;
  }

  return { text, title: `${absolute} • около ${relative} назад` };
}

export const ColumnTitle: FindingColumn = {
  id: "title",
  header: "Название",
  widthClass: "min-w-[320px] flex-[1_1_auto]",
  Cell: ({ finding }) => {
    const title = finding.title || "Без названия";
    const separatorIndex = title.indexOf(":");
    const hasSeparator = separatorIndex > 0;
    const primary = hasSeparator ? title.slice(0, separatorIndex) : title;
    const secondary = hasSeparator ? title.slice(separatorIndex + 1).trimStart() : "";

    return (
      <div className="flex min-w-0 items-center gap-2">
        <KindBadge kind={finding.kind} iconOnly />
        <span className="truncate text-sm text-zinc-200" title={title}>
          <span className="font-semibold">{primary}</span>
          {hasSeparator ? ":" : ""}
          {secondary ? ` ${secondary}` : ""}
        </span>
      </div>
    );
  },
};

export const ColumnFile: FindingColumn = {
  id: "file",
  header: "Файл",
  widthClass: "w-[240px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.file_path ? (
      <span className="truncate font-mono text-xs text-zinc-500" title={finding.file_path}>
        {finding.file_path}
        {finding.line_start ? `:${finding.line_start}` : ""}
      </span>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnComponent: FindingColumn = {
  id: "component",
  header: "Компонент",
  widthClass: "w-[220px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.component ? (
      <span className="truncate font-mono text-xs text-zinc-400">
        {finding.component}
        {finding.component_version ? `@${finding.component_version}` : ""}
      </span>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnVersionFix: FindingColumn = {
  id: "version-fix",
  header: "Фикс",
  widthClass: "w-[120px] shrink-0",
  responsiveClass: "hidden xl:block",
  Cell: ({ finding }) =>
    finding.fixed_version ? (
      <span className="font-mono text-xs text-emerald-400">→ {finding.fixed_version}</span>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnRule: FindingColumn = {
  id: "rule",
  header: "Правило",
  widthClass: "w-[200px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.rule_id ? (
      <span className="truncate font-mono text-xs text-zinc-400">{finding.rule_id}</span>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnUrl: FindingColumn = {
  id: "url",
  header: "URL",
  widthClass: "w-[260px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.url ? (
      <div className="flex items-center gap-1.5">
        {finding.http_method && (
          <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
            {finding.http_method}
          </span>
        )}
        <span className="truncate font-mono text-xs text-zinc-400">{finding.url}</span>
      </div>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnResource: FindingColumn = {
  id: "resource",
  header: "Ресурс",
  widthClass: "w-[220px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.iac_resource ? (
      <div className="flex items-center gap-1.5">
        {finding.iac_provider && (
          <span className="rounded border border-teal-700/50 bg-teal-950/40 px-1 py-0.5 text-[10px] text-teal-300">
            {finding.iac_provider}
          </span>
        )}
        <span className="truncate font-mono text-xs text-zinc-400">{finding.iac_resource}</span>
      </div>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnSecretKind: FindingColumn = {
  id: "secret-kind",
  header: "Тип",
  widthClass: "w-[140px] shrink-0",
  responsiveClass: "hidden lg:block",
  Cell: ({ finding }) =>
    finding.secret_kind ? (
      <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-300">
        {finding.secret_kind}
      </span>
    ) : (
      <span className="text-xs text-zinc-700">—</span>
    ),
};

export const ColumnEnrichment: FindingColumn = {
  id: "enrichment",
  header: "Обогащение",
  widthClass: "w-[280px] shrink-0",
  responsiveClass: "hidden xl:block",
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
};

export const ColumnProject: FindingColumn = {
  id: "project",
  header: "Проект",
  widthClass: "w-[160px] shrink-0",
  responsiveClass: "hidden md:block",
  Cell: ({ finding, onPickProject }) => (
    <ProjectPill
      id={finding.project_id}
      name={finding.project_name}
      onPick={onPickProject}
    />
  ),
};

export const ColumnAge: FindingColumn = {
  id: "age",
  header: "Обнаружено",
  widthClass: "w-[120px] shrink-0",
  align: "right",
  Cell: ({ finding, density }) => {
    const seen = formatSeenForDensity(finding.first_seen, density);
    return (
      <span className="text-right text-xs text-zinc-500" title={seen.title}>
        {seen.text}
      </span>
    );
  },
};

const COLUMNS_SCA: FindingColumn[] = [
  ColumnTitle,
  ColumnComponent,
  ColumnVersionFix,
  ColumnEnrichment,
  ColumnProject,
  ColumnAge,
];

const COLUMNS_SAST: FindingColumn[] = [
  ColumnTitle,
  ColumnFile,
  ColumnRule,
  ColumnEnrichment,
  ColumnProject,
  ColumnAge,
];

const COLUMNS_DAST: FindingColumn[] = [
  ColumnTitle,
  ColumnUrl,
  ColumnEnrichment,
  ColumnProject,
  ColumnAge,
];

const COLUMNS_IAC: FindingColumn[] = [
  ColumnTitle,
  ColumnResource,
  ColumnFile,
  ColumnEnrichment,
  ColumnProject,
  ColumnAge,
];

const COLUMNS_SECRETS: FindingColumn[] = [
  ColumnTitle,
  ColumnSecretKind,
  ColumnFile,
  ColumnProject,
  ColumnAge,
];

const COLUMNS_ALL: FindingColumn[] = [
  ColumnTitle,
  ColumnEnrichment,
  ColumnProject,
  ColumnAge,
];

export function getColumnsForKind(
  kind: FindingKind | null,
): FindingColumn[] {
  switch (kind) {
    case "sca":
      return COLUMNS_SCA;
    case "sast":
      return COLUMNS_SAST;
    case "dast":
      return COLUMNS_DAST;
    case "iac":
      return COLUMNS_IAC;
    case "secrets":
      return COLUMNS_SECRETS;
    case "other":
    case null:
    default:
      return COLUMNS_ALL;
  }
}
