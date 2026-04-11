import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2 } from "lucide-react";

import EnrichmentBadges from "@/components/findings/EnrichmentBadges";
import KindBadge from "@/components/findings/KindBadge";
import ProjectPill from "@/components/findings/ProjectPill";
import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsList } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import type { FindingsFilter } from "@/lib/findings-filter";
import type { Finding } from "@/types";
import { cn } from "@/lib/utils";
import type { Density } from "@/components/findings/FindingsToolbar";

interface FlatFindingsTableProps {
  filter: FindingsFilter;
  density: Density;
  onRowClick: (id: string) => void;
  activeRowId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!isValid(date)) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

export function FlatFindingsTable({
  filter,
  density,
  onRowClick,
  activeRowId,
  selectedIds,
  onToggleSelect,
  onCountChange,
}: FlatFindingsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFindingsList(filter);

  const findings = useMemo<Finding[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.data ?? []);
  }, [data]);

  const total = data?.pages?.[0]?.meta?.total ?? findings.length;

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  // Densities affect only the row height; the column layout is shared so the
  // header alignment stays stable.
  const rowHeight = density === "compact" ? 44 : 64;

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  // Infinite scroll: when the last virtual row is within the overscan window
  // we pull the next page.
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;
    if (last.index >= findings.length - 5 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualizer, findings.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-red-300">
        Не удалось загрузить находки:{" "}
        {error instanceof Error ? error.message : "неизвестная ошибка"}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full bg-zinc-800/40" />
        ))}
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center text-sm text-zinc-500">
        Нет находок под текущие фильтры.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const finding = findings[virtualRow.index];
          if (!finding) return null;

          const sev = severityMeta(finding.severity);
          const isActive = finding.id === activeRowId;
          const isSelected = selectedIds?.has(finding.id) ?? false;

          return (
            <div
              key={finding.id}
              className={cn(
                "absolute inset-x-0 flex cursor-pointer border-b border-zinc-900 pl-3 transition-colors hover:bg-zinc-900/60",
                "border-l-4 pr-4",
                sev.borderClass,
                isActive && "bg-zinc-900/80",
                isSelected && "bg-red-950/10",
                density === "compact" ? "items-center py-1.5" : "items-start py-3",
              )}
              style={{
                height: rowHeight,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onRowClick(finding.id)}
            >
              {onToggleSelect && (
                <div
                  className="mr-2 flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(finding.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <KindBadge kind={finding.kind} iconOnly />
                  <span className="truncate text-sm font-medium text-zinc-200">
                    {finding.title || "Без названия"}
                  </span>
                </div>
                {density === "comfortable" && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    {finding.file_path && (
                      <span className="truncate font-mono">
                        {finding.file_path}
                        {finding.line_start ? `:${finding.line_start}` : ""}
                      </span>
                    )}
                    {finding.component && (
                      <span className="truncate">
                        {finding.component}
                        {finding.component_version
                          ? `@${finding.component_version}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden w-[220px] shrink-0 xl:block">
                <EnrichmentBadges
                  inKev={finding.in_kev}
                  inBdu={finding.in_bdu}
                  maxEpss={finding.max_epss}
                  maxCvss={finding.max_cvss}
                  fixedVersion={finding.fixed_version}
                  compact
                />
              </div>

              <div className="hidden w-[160px] shrink-0 md:block">
                <ProjectPill
                  id={finding.project_id}
                  name={finding.project_name}
                />
              </div>

              <div className="w-[110px] shrink-0 text-right text-xs text-zinc-500">
                {formatRelative(finding.first_seen)}
              </div>
            </div>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="flex items-center justify-center py-3 text-xs text-zinc-500">
          {isFetchingNextPage ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Загрузка ещё…
            </span>
          ) : (
            <span>Прокрутите, чтобы загрузить ещё</span>
          )}
        </div>
      )}
    </div>
  );
}

export default FlatFindingsTable;
