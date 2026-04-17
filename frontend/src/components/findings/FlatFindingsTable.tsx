import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, SearchX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsList } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import { getColumnsForKind } from "@/components/findings/columns";
import type { FindingsFilter } from "@/lib/findings-filter";
import type { Finding, FindingKind } from "@/types";
import { cn } from "@/lib/utils";
import type { Density } from "@/components/findings/FindingsToolbar";

interface FlatFindingsTableProps {
  filter: FindingsFilter;
  density: Density;
  onRowClick: (id: string, triggerEl?: HTMLElement | null) => void;
  activeRowId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectRange?: (ids: string[]) => void;
  onPickProject?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function FlatFindingsTable({
  filter,
  density,
  onRowClick,
  activeRowId,
  selectedIds,
  onToggleSelect,
  onSelectRange,
  onPickProject,
  onCountChange,
  onResetFilters,
  hasActiveFilters,
}: FlatFindingsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);

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

  // Kind-aware column set: when the user has narrowed to exactly one kind
  // the table flips to the columns specialised for that kind. Multi-kind or
  // unscoped views get the generic set.
  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;
  const columns = useMemo(() => getColumnsForKind(activeKind), [activeKind]);

  // Densities affect only the row height; the column layout is shared so the
  // header alignment stays stable.
  const rowHeight =
    density === "compact" ? 32 : density === "comfortable" ? 44 : 56;

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll: when the last virtual row is within the overscan window
  // we pull the next page.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= findings.length - 5 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, findings.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
    <div className="flex min-h-0 flex-1 flex-col" role="grid" aria-rowcount={findings.length}>
      {/* Column header strip — sticky above the scroll container. Offset the
        checkbox column when selection is enabled so headers line up with
        row content below. */}
      <div role="row" className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {onToggleSelect && <div className="w-4 shrink-0" />}
        {columns.map((col) => (
          <div
            role="columnheader"
            key={col.id}
            className={cn(
              col.widthClass,
              col.responsiveClass,
              col.align === "right" && "text-right",
            )}
          >
            {col.header}
          </div>
        ))}
      </div>

      <div ref={parentRef} className="themed-scrollbar min-h-0 min-w-0 flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const finding = findings[virtualRow.index];
            if (!finding) return null;

            const sev = severityMeta(finding.severity);
            const isActive = finding.id === activeRowId;
            const isSelected = selectedIds?.has(finding.id) ?? false;

            return (
              <div
                key={finding.id}
                role="row"
                tabIndex={0}
                className={cn(
                  "absolute inset-x-0 relative flex cursor-pointer items-center gap-3 border-b border-zinc-900 pl-3 pr-4 transition-colors hover:bg-zinc-800/50",
                  "border-l-[3px]",
                  sev.borderClass,
                  isActive && "bg-red-950/18",
                  isSelected && "bg-red-950/12",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600/70 focus-visible:outline-offset-[-2px]",
                  density === "compact" && "py-0",
                  density === "comfortable" && "py-1",
                  density === "spacious" && "py-2.5",
                )}
                style={{
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={(e) => onRowClick(finding.id, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(finding.id, e.currentTarget);
                  }
                }}
              >
                {isSelected && (
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-red-500" />
                )}
                {onToggleSelect && (
                  <div
                    className="flex w-4 shrink-0 items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      const index = findings.findIndex((f) => f.id === finding.id);
                      if (e.shiftKey && onSelectRange && lastSelectedIndexRef.current != null && index >= 0) {
                        const start = Math.min(lastSelectedIndexRef.current, index);
                        const end = Math.max(lastSelectedIndexRef.current, index);
                        onSelectRange(findings.slice(start, end + 1).map((f) => f.id));
                        lastSelectedIndexRef.current = index;
                        return;
                      }
                      if (index >= 0) {
                        lastSelectedIndexRef.current = index;
                      }
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

                {columns.map((col) => {
                  const Cell = col.Cell;
                  return (
                    <div
                      role="gridcell"
                      key={col.id}
                      className={cn(
                        "flex min-w-0 items-center",
                        col.widthClass,
                        col.responsiveClass,
                        col.align === "right" && "justify-end",
                      )}
                    >
                      <Cell
                        finding={finding}
                        density={density}
                        onPickProject={onPickProject}
                      />
                    </div>
                  );
                })}
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
    </div>
  );
}

export default FlatFindingsTable;
