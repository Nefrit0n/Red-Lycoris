import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Bug,
  ChevronDown,
  ChevronRight,
  FileCode,
  Package,
  ShieldAlert,
  ShieldQuestion,
  SearchX,
} from "lucide-react";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsGroups, useFindingsList } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import { getColumnsForKeys } from "@/components/findings/columns";
import type { FindingsFilter, GroupBy } from "@/lib/findings-filter";
import type { Finding, FindingKind } from "@/types";
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

// Group-mode metadata: what icon to render, how to label the group title,
// what placeholder to show for empty keys. The backend sends the same
// `group_key` field regardless of mode, so the page knows it came from
// cve/component/rule/cwe only via `filter.groupBy`.
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
  cwe: {
    icon: ShieldQuestion,
    label: "CWE",
    empty: "Без CWE",
    // group_key is the numeric CWE ID as a string, e.g. "798"
    format: (k) => (k ? `CWE-${k}` : "Без CWE"),
  },
};

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!isValid(date)) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

// Build an overlay filter for fetching the children of a single group. The
// approach is: strip groupBy and narrow the filter to just the group key.
// CVE has a first-class server-side filter; component/rule fall back to the
// free-text search which the backend indexes on both fields.
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
    case "cwe": {
      const n = parseInt(groupKey, 10);
      overlay.cwe = Number.isNaN(n) ? null : n;
      break;
    }
  }
  return overlay;
}

// GroupChildren owns its own query so hooks are not called inside the parent
// map. It renders up to 100 findings inline, reusing the same column catalog
// the flat table uses so column alignment matches visually.
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

  // Expanded group keys: Set makes toggling O(1) and the memo keeps hover
  // handlers stable. Expansion state is local — nothing about it lives in the
  // URL, so changing groupBy naturally resets expansions via unmount.
  const [expandedByMode, setExpandedByMode] = useState<
    Partial<Record<Exclude<GroupBy, "">, Set<string>>>
  >({});

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  const toggle = (mode: Exclude<GroupBy, "">, key: string) => {
    setExpandedByMode((prev) => {
      const modeSet = new Set(prev[mode] ?? []);
      if (modeSet.has(key)) modeSet.delete(key);
      else modeSet.add(key);
      return { ...prev, [mode]: modeSet };
    });
  };

  // groupBy === "" is handled by the flat table — but defend anyway so this
  // component can be dropped in without guessing the caller's state.
  const effectiveGroupBy: Exclude<GroupBy, ""> =
    filter.groupBy === "" ? "cve" : filter.groupBy;
  const expanded = expandedByMode[effectiveGroupBy] ?? new Set<string>();
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
          // Click jumps to the first sample finding — the preview panel opens
          // on that row and the user can use the carousel to step through the
          // rest of the sample set.
          const firstSample = group.sample_ids?.[0];
          const interactive = !!firstSample;
          const key = group.group_key || `${effectiveGroupBy}-empty`;
          const isExpanded = expanded.has(key);
          // Empty-key groups cannot be expanded — there's no server-side way
          // to filter "findings where cve IS NULL" through our current API.
          const canExpand = !!group.group_key;

          return (
            <div key={key}>
              <div
                className={cn(
                  "flex items-start gap-2 border-l-4 px-3 py-3 transition-colors",
                  sev.borderClass,
                )}
              >
                <button
                  type="button"
                  disabled={!canExpand}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canExpand) toggle(effectiveGroupBy, key);
                  }}
                  className={cn(
                    "mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 transition-colors",
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

                <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />

                <div
                  className={cn(
                    "min-w-0 flex-1",
                    interactive && "cursor-pointer",
                  )}
                  onClick={
                    interactive ? (e) => onRowClick(firstSample, e.currentTarget) : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-zinc-200">
                      {meta.format(group.group_key)}
                    </span>
                    <SeverityBadge severity={group.max_severity} short />
                  </div>

                  {group.description && (
                    <div className="mt-0.5 line-clamp-1 max-w-2xl text-xs text-zinc-500">
                      {group.description}
                    </div>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Bug className="size-3" />
                      {group.findings_count.toLocaleString("ru-RU")} находок
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="size-3" />
                      {group.projects_count.toLocaleString("ru-RU")} проектов
                    </span>
                    <span>Впервые {formatRelative(group.first_seen)}</span>
                  </div>
                </div>

                <EnrichmentBadges
                  inKev={group.in_kev}
                  maxEpss={group.max_epss}
                  maxCvss={group.max_cvss}
                  className="hidden shrink-0 md:flex"
                />
              </div>

              {isExpanded && canExpand && (
                <div className="bg-zinc-950/40 pl-10 pr-3 py-1">
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
