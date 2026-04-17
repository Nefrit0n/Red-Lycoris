import { memo, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, SearchX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useFindingsList } from "@/api/findings";
import { severityMeta } from "@/lib/severity";
import { getColumnsForKeys, type FindingColumn } from "@/components/findings/columns";
import type { FindingsFilter } from "@/lib/findings-filter";
import type { Finding, FindingKind } from "@/types";
import { cn } from "@/lib/utils";
import type { ColumnKey } from "@/components/findings/findingsTableConfig";

interface FlatFindingsTableProps {
  filter: FindingsFilter;
  rowHeight: number;
  columnKeys: ColumnKey[];
  onRowClick: (id: string, triggerEl?: HTMLElement | null) => void;
  activeRowId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectRange?: (ids: string[]) => void;
  onPickProject?: (id: string) => void;
  onCountChange?: (total: number, fetching: boolean) => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  onVisibleIdsChange?: (ids: string[]) => void;
}

const Row = memo(function Row({
  finding,
  columns,
  isActive,
  isSelected,
  top,
  height,
  onRowClick,
  onPickProject,
  onToggleSelect,
  onSelectRange,
  findings,
  lastSelectedIndexRef,
}: {
  finding: Finding;
  columns: FindingColumn[];
  isActive: boolean;
  isSelected: boolean;
  top: number;
  height: number;
  onRowClick: (id: string, triggerEl?: HTMLElement | null) => void;
  onPickProject?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onSelectRange?: (ids: string[]) => void;
  findings: Finding[];
  lastSelectedIndexRef: MutableRefObject<number | null>;
}) {
  const sev = severityMeta(finding.severity);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      data-finding-row-id={finding.id}
      role="row"
      tabIndex={0}
      className={cn(
        "absolute inset-x-0 flex cursor-pointer items-center gap-3 border-t border-[color:var(--row-border)] pl-3 pr-4 transition-colors hover:bg-zinc-800/45",
        "border-l-[3px]",
        sev.borderClass,
        isActive && "bg-red-950/20",
        isSelected && "bg-red-950/12",
      )}
      style={{
        height,
        transform: `translateY(${top}px)`,
      }}
      onClick={(e) => onRowClick(finding.id, e.currentTarget)}
    >
      {onToggleSelect && (
        <div
          className="flex w-[40px] shrink-0 items-center"
          onClick={(e) => {
            e.stopPropagation();
            const index = findings.findIndex((f) => f.id === finding.id);
            if (e.shiftKey && onSelectRange) {
              const prev = lastSelectedIndexRef.current;
              if (prev != null && index >= 0) {
                const start = Math.min(prev, index);
                const end = Math.max(prev, index);
                onSelectRange(findings.slice(start, end + 1).map((f) => f.id));
              }
            }
            lastSelectedIndexRef.current = index;
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
              "flex min-w-0 items-center py-2.5",
              col.widthClass,
              col.align === "right" && "justify-end",
            )}
          >
            <Cell finding={finding} onPickProject={onPickProject} />
          </div>
        );
      })}
    </div>
  );
});

export function FlatFindingsTable({
  filter,
  rowHeight,
  columnKeys,
  onRowClick,
  activeRowId,
  selectedIds,
  onToggleSelect,
  onSelectRange,
  onPickProject,
  onCountChange,
  onResetFilters,
  hasActiveFilters,
  onVisibleIdsChange,
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

  useEffect(() => {
    onVisibleIdsChange?.(findings.map((f) => f.id));
  }, [findings, onVisibleIdsChange]);

  const total = data?.pages?.[0]?.meta?.total ?? findings.length;

  useEffect(() => {
    onCountChange?.(total, isFetching);
  }, [total, isFetching, onCountChange]);

  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;
  const tab = activeKind ?? "all";
  const columns = useMemo(() => getColumnsForKeys(tab, columnKeys), [columnKeys, tab]);

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const virtualItems = virtualizer.getVirtualItems();

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
        Не удалось загрузить находки: {error instanceof Error ? error.message : "неизвестная ошибка"}
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
    <div className="flex min-h-0 flex-1 flex-col [--row-border:rgba(255,255,255,0.05)]" role="grid" aria-rowcount={findings.length}>
      <div role="row" className="flex items-center border-b border-zinc-800 bg-zinc-950/60 px-0 pl-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {onToggleSelect && <div className="w-[40px] shrink-0" />}
        {columns.map((col) => (
          <div
            role="columnheader"
            key={col.id}
            className={cn(col.widthClass, "py-2", col.align === "right" && "text-right")}
          >
            {col.header}
          </div>
        ))}
      </div>

      <div ref={parentRef} className="themed-scrollbar min-h-0 min-w-0 flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualItems.map((virtualRow) => {
            const finding = findings[virtualRow.index];
            if (!finding) return null;
            return (
              <Row
                key={finding.id}
                finding={finding}
                findings={findings}
                columns={columns}
                isActive={finding.id === activeRowId}
                isSelected={selectedIds?.has(finding.id) ?? false}
                top={virtualRow.start}
                height={rowHeight}
                onRowClick={onRowClick}
                onPickProject={onPickProject}
                onToggleSelect={onToggleSelect}
                onSelectRange={onSelectRange}
                lastSelectedIndexRef={lastSelectedIndexRef}
              />
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
