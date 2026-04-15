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
} from "lucide-react";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsGroups, useFindingsList } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import { getColumnsForKind } from "@/components/findings/columns";
import type { FindingsFilter, GroupBy } from "@/lib/findings-filter";
import type { Finding, FindingKind } from "@/types";
import { cn } from "@/lib/utils";

interface GroupedFindingsTableProps {
  filter: FindingsFilter;
  onRowClick: (id: string) => void;
  onPickProject?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
}

// Group-mode metadata: what icon to render, how to label the group title,
// what placeholder to show for empty keys. The backend sends the same
// `group_key` field regardless of mode, so the page knows it came from
// cve/component/rule only via `filter.groupBy`.
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
  const overlay: FindingsFilter = { ...base, groupBy: "" };
  switch (groupBy) {
    case "cve":
      overlay.cve = groupKey;
      break;
    case "component":
    case "rule":
      overlay.query = groupKey;
      break;
  }
  return overlay;
}

// GroupChildren owns its own query so hooks are not called inside the parent
// map. It renders up to 100 findings inline, reusing the same column catalog
// the flat table uses so column alignment matches visually.
function GroupChildren({
  filter,
  onRowClick,
  onPickProject,
}: {
  filter: FindingsFilter;
  onRowClick: (id: string) => void;
  onPickProject?: (id: string) => void;
}) {
  const { data, isLoading, isError, error } = useFindingsList(filter);

  const findings = useMemo<Finding[]>(
    () => data?.pages?.flatMap((p) => p.data ?? []) ?? [],
    [data],
  );

  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;
  const columns = useMemo(() => getColumnsForKind(activeKind), [activeKind]);

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
            onClick={() => onRowClick(finding.id)}
            className={cn(
              "flex cursor-pointer items-center gap-3 border-b border-zinc-900/60 border-l-4 py-1.5 pl-3 pr-4 transition-colors hover:bg-zinc-900/60",
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
                    col.responsiveClass,
                    col.align === "right" && "justify-end",
                  )}
                >
                  <Cell finding={finding} onPickProject={onPickProject} />
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
  onRowClick,
  onPickProject,
  onCountChange,
}: GroupedFindingsTableProps) {
  const { data, isLoading, isError, error, isFetching } =
    useFindingsGroups(filter);

  const groups = useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta?.total ?? groups.length;

  // Expanded group keys: Set makes toggling O(1) and the memo keeps hover
  // handlers stable. Expansion state is local — nothing about it lives in the
  // URL, so changing groupBy naturally resets expansions via unmount.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  // Changing the grouping mode must clear the expanded set — otherwise stale
  // group keys from a previous mode would leak across.
  useEffect(() => {
    setExpanded(new Set());
  }, [filter.groupBy]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // groupBy === "" is handled by the flat table — but defend anyway so this
  // component can be dropped in without guessing the caller's state.
  const effectiveGroupBy: Exclude<GroupBy, ""> =
    filter.groupBy === "" ? "cve" : filter.groupBy;
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
      <div className="flex min-h-[320px] flex-1 items-center justify-center text-sm text-zinc-500">
        Нет групп под текущие фильтры.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
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
                    if (canExpand) toggle(key);
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
                    interactive ? () => onRowClick(firstSample) : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-zinc-200">
                      {meta.format(group.group_key)}
                    </span>
                    <SeverityBadge severity={group.max_severity} short />
                  </div>

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
                  compact
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
