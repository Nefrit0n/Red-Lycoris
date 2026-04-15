import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";

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
  onRowClick: (id: string) => void;
  activeRowId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPickProject?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
}

export function FlatFindingsTable({
  filter,
  density,
  onRowClick,
  activeRowId,
  selectedIds,
  onToggleSelect,
  onPickProject,
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

  // Kind-aware column set: when the user has narrowed to exactly one kind
  // the table flips to the columns specialised for that kind. Multi-kind or
  // unscoped views get the generic set.
  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;
  const columns = useMemo(() => getColumnsForKind(activeKind), [activeKind]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Column header strip — sticky above the scroll container. Offset the
        checkbox column when selection is enabled so headers line up with
        row content below. */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {onToggleSelect && <div className="w-4 shrink-0" />}
        {columns.map((col) => (
          <div
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
                  "absolute inset-x-0 flex cursor-pointer items-center gap-3 border-b border-zinc-900 pl-3 pr-4 transition-colors hover:bg-zinc-900/60",
                  "border-l-4",
                  sev.borderClass,
                  isActive && "bg-zinc-900/80",
                  isSelected && "bg-red-950/10",
                  density === "compact" ? "py-1.5" : "py-3",
                )}
                style={{
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick(finding.id)}
              >
                {onToggleSelect && (
                  <div
                    className="flex w-4 shrink-0 items-center"
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
