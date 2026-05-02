import { useEffect, useMemo } from "react";
import { formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Bug,
  ChevronDown,
  ChevronRight,
  FileCode,
  KeyRound,
  Package,
  ShieldAlert,
  SearchX,
} from "lucide-react";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import GroupActionsMenu from "@/components/findings/GroupActionsMenu";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsGroups, useFindingsList } from "@/api/findings";
import { useExpandedGroups } from "@/hooks/use-expanded-groups";
import { severityMeta } from "@/lib/severity";
import { getColumnsForKeys } from "@/components/findings/columns";
import type { FindingsFilter, GroupBy } from "@/lib/findings-filter";
import type { Finding, FindingGroup, FindingKind } from "@/types";
import { cn } from "@/lib/utils";
import type { ColumnKey } from "@/components/findings/findingsTableConfig";

interface GroupedFindingsTableProps {
  filter: FindingsFilter;
  rowHeight: number;
  columnKeys: ColumnKey[];
  onRowClick: (id: string, triggerEl?: HTMLElement | null) => void;
  onPickProject?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

const GROUP_META: Record<
  Exclude<GroupBy, "">,
  {
    icon: typeof Bug;
    label: string;
    empty: string;
    format: (key: string) => string;
  }
> = {
  cve: {
    icon: ShieldAlert,
    label: "CVE",
    empty: "Без CVE",
    format: (k) => k || "Без CVE",
  },
  component: {
    icon: Package,
    label: "Компонент",
    empty: "Без компонента",
    format: (k) => k || "Без компонента",
  },
  rule: {
    icon: FileCode,
    label: "Правило",
    empty: "Без правила",
    format: (k) => k || "Без правила",
  },
  secret: {
    icon: KeyRound,
    label: "Секрет",
    empty: "Без отпечатка",
    format: (k) => (k ? `Секрет ${k.slice(0, 12)}…` : "Без отпечатка"),
  },
  cwe: {
    icon: Bug,
    label: "CWE",
    empty: "Без CWE",
    format: (k) => (k ? `CWE-${k}` : "Без CWE"),
  },
};

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!isValid(date)) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

function buildOverlayFilter(
  base: FindingsFilter,
  groupBy: Exclude<GroupBy, "">,
  groupKey: string,
): FindingsFilter {
  const overlay: FindingsFilter = {
    ...base,
    groupBy: "",
    cve: "",
    component: "",
    componentVersion: "",
    ruleId: "",
    secretFingerprint: "",
    query: "",
  };
  switch (groupBy) {
    case "cve":
      overlay.cve = groupKey;
      break;
    case "component": {
      const at = groupKey.lastIndexOf("@");
      overlay.component = at >= 0 ? groupKey.slice(0, at) : groupKey;
      overlay.componentVersion = at >= 0 ? groupKey.slice(at + 1) : "";
      break;
    }
    case "rule": {
      const sep = " — ";
      const i = groupKey.indexOf(sep);
      overlay.ruleId = i >= 0 ? groupKey.slice(0, i) : groupKey;
      break;
    }
    case "secret":
      overlay.secretFingerprint = groupKey;
      break;
    case "cwe":
      overlay.cwe = parseInt(groupKey, 10) || null;
      break;
  }
  return overlay;
}

function GroupChildren({
  filter,
  rowHeight,
  columnKeys,
  onRowClick,
  onPickProject,
}: {
  filter: FindingsFilter;
  rowHeight: number;
  columnKeys: ColumnKey[];
  onRowClick: (id: string, triggerEl?: HTMLElement | null) => void;
  onPickProject?: (id: string) => void;
}) {
  const { data, isLoading, isError, error } = useFindingsList(filter);

  const findings = useMemo<Finding[]>(
    () => data?.pages?.flatMap((p) => p.data ?? []) ?? [],
    [data],
  );

  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;
  const tab = activeKind ?? "all";
  const columns = useMemo(() => getColumnsForKeys(tab, columnKeys), [columnKeys, tab]);

  if (isLoading) {
    return (
      <div className="space-y-1.5 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full bg-zinc-800/40" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-2 text-xs text-red-300">
        Не удалось загрузить находки:{" "}
        {error instanceof Error ? error.message : "неизвестная ошибка"}
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="py-2 text-xs text-zinc-600">
        Нет находок в этой группе.
      </div>
    );
  }

  return (
    <div className="flex flex-col border-l border-zinc-800">
      {findings.slice(0, 100).map((finding) => {
        const sev = severityMeta(finding.severity);
        return (
          <div
            key={finding.id}
            style={{ minHeight: rowHeight }}
            tabIndex={0}
            onClick={(e) => onRowClick(finding.id, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick(finding.id, e.currentTarget);
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-3 border-t border-[color:var(--row-border)] border-l-[3px] pl-3 pr-4 transition-colors hover:bg-zinc-800/50",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600/70 focus-visible:outline-offset-[-2px]",
              "py-2.5",
              sev.borderClass,
            )}
          >
            {columns.map((col) => {
              const Cell = col.Cell;
              return (
                <div
                  key={col.id}
                  className={cn(
                    "flex min-w-0 items-center",
                    col.widthClass,
                    col.align === "right" && "justify-end",
                  )}
                >
                  <Cell
                    finding={finding}
                    onPickProject={onPickProject}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      {findings.length >= 100 && (
        <div className="py-1.5 pl-3 text-[11px] text-zinc-600">
          Показаны первые 100 находок. Сбросьте группировку, чтобы увидеть все.
        </div>
      )}
    </div>
  );
}

function GroupModeBadges({
  group,
  groupBy,
}: {
  group: FindingGroup;
  groupBy: Exclude<GroupBy, "">;
}) {
  if (groupBy === "component") {
    return (
      <>
        {group.ecosystem && (
          <span className="inline-flex h-4 items-center rounded border border-zinc-600 px-1.5 text-[10px] text-zinc-400">
            {group.ecosystem}
          </span>
        )}
        {group.fixed_version && (
          <span className="inline-flex h-4 items-center rounded border border-emerald-600/60 px-1.5 text-[10px] text-emerald-400">
            fix: {group.fixed_version}
          </span>
        )}
      </>
    );
  }
  if (groupBy === "secret" && group.secret_kind) {
    return (
      <span className="inline-flex h-4 items-center rounded border border-zinc-600 px-1.5 text-[10px] text-zinc-400">
        {group.secret_kind}
      </span>
    );
  }
  return null;
}

export function GroupedFindingsTable({
  filter,
  rowHeight,
  columnKeys,
  onRowClick,
  onPickProject,
  onCountChange,
  onResetFilters,
  hasActiveFilters,
}: GroupedFindingsTableProps) {
  const { data, isLoading, isError, error, isFetching } =
    useFindingsGroups(filter);

  const groups = useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta?.total ?? groups.length;

  const effectiveGroupBy: Exclude<GroupBy, ""> =
    filter.groupBy === "" ? "cve" : filter.groupBy;

  const { expanded, toggle } = useExpandedGroups(effectiveGroupBy);

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  const meta = GROUP_META[effectiveGroupBy];
  const Icon = meta.icon;

  if (isError) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-red-300">
        Не удалось загрузить группы:{" "}
        {error instanceof Error ? error.message : "неизвестная ошибка"}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-zinc-800/40" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <SearchX className="size-7 text-zinc-600" />
        <div>Находок не найдено</div>
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800/60"
          >
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="themed-scrollbar min-h-0 min-w-0 flex-1 overflow-auto [--row-border:rgba(255,255,255,0.05)]">
      <div className="divide-y divide-zinc-900">
        {groups.map((group) => {
          const sev = severityMeta(group.max_severity);
          const firstSample = group.sample_ids?.[0];
          const interactive = !!firstSample;
          const key = group.group_key || `${effectiveGroupBy}-empty`;
          const isExpanded = expanded.has(key);
          const canExpand = !!group.group_key;
          // For CVE mode the group_key IS the CVE ID — always show it as
          // primary label. group_title holds the NVD description (secondary).
          const isCveMode = effectiveGroupBy === "cve";
          const primaryTitle = isCveMode
            ? meta.format(group.group_key)
            : (group.group_title || meta.format(group.group_key));
          const subtitle = isCveMode ? group.group_title : undefined;

          return (
            <div key={key}>
              <div
                className={cn(
                  "flex items-center gap-2 border-l-4 px-3 py-2 transition-colors hover:bg-zinc-900/30",
                  sev.borderClass,
                )}
              >
                {/* Expand toggle */}
                <button
                  type="button"
                  disabled={!canExpand}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canExpand) toggle(key);
                  }}
                  className={cn(
                    "shrink-0 rounded p-0.5 text-zinc-500 transition-colors",
                    canExpand
                      ? "hover:bg-zinc-800 hover:text-zinc-200"
                      : "cursor-default opacity-30",
                  )}
                  aria-label={isExpanded ? "Свернуть группу" : "Развернуть группу"}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>

                <Icon className="size-4 shrink-0 text-zinc-500" />

                {/* Title + severity + mode badges — takes remaining space, truncates */}
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                    interactive && "cursor-pointer",
                  )}
                  onClick={
                    interactive
                      ? (e) => onRowClick(firstSample, e.currentTarget)
                      : undefined
                  }
                >
                  <span className="shrink-0 font-mono text-sm font-medium text-zinc-200">
                    {primaryTitle}
                  </span>
                  {subtitle && (
                    <span className="min-w-0 truncate text-xs text-zinc-500">
                      {subtitle}
                    </span>
                  )}
                  <SeverityBadge severity={group.max_severity} short />
                  <GroupModeBadges group={group} groupBy={effectiveGroupBy} />
                </div>

                {/* Stats — right-aligned, hidden on narrow viewports */}
                <div className="hidden shrink-0 items-center gap-3 text-xs text-zinc-500 lg:flex">
                  <span className="flex items-center gap-1">
                    <Bug className="size-3" />
                    {group.findings_count.toLocaleString("ru-RU")} находок
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="size-3" />
                    {group.projects_count.toLocaleString("ru-RU")} проектов
                  </span>
                  <span>{formatRelative(group.last_seen)}</span>
                </div>

                <EnrichmentBadges
                  inKev={group.in_kev}
                  inBdu={group.in_bdu}
                  maxEpss={group.max_epss}
                  maxCvss={group.max_cvss}
                  className="w-[180px] shrink-0"
                />

                <GroupActionsMenu
                  group={group}
                  groupBy={effectiveGroupBy}
                  onCollapse={() => { if (isExpanded) toggle(key); }}
                />
              </div>

              {isExpanded && canExpand && (
                <div className="bg-zinc-950/40 py-1 pl-10 pr-3">
                  <GroupChildren
                    filter={buildOverlayFilter(
                      filter,
                      effectiveGroupBy,
                      group.group_key,
                    )}
                    rowHeight={rowHeight}
                    columnKeys={columnKeys}
                    onRowClick={onRowClick}
                    onPickProject={onPickProject}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GroupedFindingsTable;
