import { useEffect, useMemo } from "react";
import { formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { Bug, FileCode, Package, ShieldAlert } from "lucide-react";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsGroups } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import type { FindingsFilter, GroupBy } from "@/lib/findings-filter";
import { cn } from "@/lib/utils";

interface GroupedFindingsTableProps {
  filter: FindingsFilter;
  onRowClick: (id: string) => void;
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

export function GroupedFindingsTable({
  filter,
  onRowClick,
  onCountChange,
}: GroupedFindingsTableProps) {
  const { data, isLoading, isError, error, isFetching } =
    useFindingsGroups(filter);

  const groups = useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta?.total ?? groups.length;

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  // groupBy === "" is handled by the flat table — but defend anyway so this
  // component can be dropped in without guessing the caller's state.
  const meta =
    filter.groupBy === "" ? GROUP_META.cve : GROUP_META[filter.groupBy];
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

          return (
            <div
              key={group.group_key || `${filter.groupBy}-empty`}
              className={cn(
                "flex items-start gap-3 border-l-4 px-4 py-3 transition-colors",
                sev.borderClass,
                interactive && "cursor-pointer hover:bg-zinc-900/60",
              )}
              onClick={
                interactive ? () => onRowClick(firstSample) : undefined
              }
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />

              <div className="min-w-0 flex-1">
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
          );
        })}
      </div>
    </div>
  );
}

export default GroupedFindingsTable;
