import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
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
import { COLUMN_WIDTH_PX } from "@/components/findings/findingsTableConfig";

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

interface StickyMeta {
  sticky: boolean;
  className?: string;
  style?: CSSProperties;
}

function columnStickyMeta(columnId: string, isHeader = false, hasScrollRight = false): StickyMeta {
  if (columnId === "checkbox") {
    return {
      sticky: true,
      className: cn(
        "sticky left-[var(--sticky-left-0)]",
        isHeader ? "z-[3] bg-zinc-950/95" : "z-[2] bg-zinc-950",
      ),
    };
  }

  if (columnId === "type") {
    return {
      sticky: true,
      className: cn(
        "sticky left-[var(--sticky-left-1)]",
        isHeader ? "z-[2] bg-zinc-950/95" : "z-[2] bg-zinc-950",
      ),
    };
  }

  if (columnId === "name") {
    return {
      sticky: true,
      className: cn(
        "sticky left-[var(--sticky-left-2)]",
        isHeader ? "z-[1] bg-zinc-950/95" : "z-[1] bg-zinc-950",
      ),
      style: hasScrollRight
        ? { boxShadow: "4px 0 6px -2px rgba(0,0,0,0.3)" }
        : undefined,
    };
  }

  return { sticky: false };
}

const Row = memo(function Row({
  finding,
  columns,
  isActive,
  isSelected,
  top,
  height,
  rowWidth,
  hasScrollRight,
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
  rowWidth: number;
  hasScrollRight: boolean;
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
        "group absolute left-0 flex cursor-pointer items-center border-t border-[color:var(--row-border)] border-l-[3px] transition-colors hover:bg-zinc-800/45",
        sev.borderClass,
        isActive && "bg-red-950/20",
        isSelected && "bg-red-950/12",
      )}
      style={{
        width: rowWidth,
        height,
        maxHeight: height,
        transform: `translateY(${top}px)`,
      }}
      onClick={(e) => onRowClick(finding.id, e.currentTarget)}
    >
      {onToggleSelect && (
        <div
          className={cn(
            "flex h-full w-[40px] shrink-0 items-center overflow-hidden border-r border-transparent px-3 group-hover:border-zinc-800/60",
            columnStickyMeta("checkbox", false, hasScrollRight).className,
          )}
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
        const sticky = columnStickyMeta(col.id, false, hasScrollRight);
        return (
          <div
            role="gridcell"
            key={col.id}
            className={cn(
              "flex h-full items-center overflow-hidden border-r border-transparent px-3 group-hover:border-zinc-800/60",
              col.id === "type" && "justify-center px-1.5",
              col.align === "right" && "justify-end",
              sticky.className,
            )}
            style={{
              width: col.widthPx,
              minWidth: col.widthPx,
              maxWidth: col.widthPx,
              ...sticky.style,
            }}
          >
            <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap">
              <Cell finding={finding} onPickProject={onPickProject} />
            </div>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const hideBarTimeoutRef = useRef<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);

  const [scrollState, setScrollState] = useState({ left: 0, max: 0, client: 0 });
  const [showHorizontalIndicator, setShowHorizontalIndicator] = useState(false);

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

  const rowWidth = useMemo(
    () => (onToggleSelect ? COLUMN_WIDTH_PX.checkbox : 0) + columns.reduce((sum, col) => sum + col.widthPx, 0),
    [columns, onToggleSelect],
  );

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    const scroller = scrollRef.current;
    if (!last || !scroller) return;

    const remainingPx = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);
    const nearBottom = remainingPx <= rowHeight * 6;

    if (nearBottom && last.index >= findings.length - 5 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, findings.length, hasNextPage, isFetchingNextPage, fetchNextPage, rowHeight]);

  const syncScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      left: el.scrollLeft,
      max: Math.max(0, el.scrollWidth - el.clientWidth),
      client: el.clientWidth,
    });
  };

  useEffect(() => {
    syncScrollState();
  }, [rowWidth, findings.length]);

  const showIndicatorTemporarily = () => {
    setShowHorizontalIndicator(true);
    if (hideBarTimeoutRef.current) {
      window.clearTimeout(hideBarTimeoutRef.current);
    }
    hideBarTimeoutRef.current = window.setTimeout(() => {
      setShowHorizontalIndicator(false);
    }, 1000);
  };

  useEffect(() => () => {
    if (hideBarTimeoutRef.current) {
      window.clearTimeout(hideBarTimeoutRef.current);
    }
  }, []);

  const hasScrollRight = scrollState.left < scrollState.max - 1;
  const hasScrollLeft = scrollState.left > 0;

  const thumbWidth = scrollState.max > 0
    ? Math.max(28, (scrollState.client / (scrollState.client + scrollState.max)) * scrollState.client)
    : scrollState.client;
  const thumbLeft = scrollState.max > 0
    ? (scrollState.left / scrollState.max) * (scrollState.client - thumbWidth)
    : 0;

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
    <div
      className="relative flex min-h-0 flex-1 flex-col [--row-border:rgba(255,255,255,0.05)]"
      role="grid"
      aria-rowcount={findings.length}
      style={{
        ["--sticky-left-0" as string]: "0px",
        ["--sticky-left-1" as string]: `${COLUMN_WIDTH_PX.checkbox}px`,
        ["--sticky-left-2" as string]: `${COLUMN_WIDTH_PX.checkbox + COLUMN_WIDTH_PX.type}px`,
      }}
    >
      <div
        ref={scrollRef}
        className="themed-scrollbar min-h-0 min-w-0 flex-1 overflow-auto"
        onScroll={() => {
          syncScrollState();
          showIndicatorTemporarily();
        }}
        onMouseEnter={showIndicatorTemporarily}
        onMouseMove={showIndicatorTemporarily}
      >
        <div style={{ width: rowWidth, minWidth: rowWidth }}>
          <div role="row" className="sticky top-0 z-[2] flex h-11 items-center border-b border-zinc-800 bg-zinc-950/95 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur">
            {onToggleSelect && (
              <div
                role="columnheader"
                className={cn(
                  "flex h-full w-[40px] shrink-0 items-center border-r border-zinc-800/80 px-3",
                  columnStickyMeta("checkbox", true, hasScrollRight).className,
                )}
              />
            )}
            {columns.map((col) => {
              const sticky = columnStickyMeta(col.id, true, hasScrollRight);
              return (
                <div
                  role="columnheader"
                  key={col.id}
                  className={cn(
                    "flex h-full items-center border-r border-zinc-800/80 px-3",
                    col.id === "type" && "justify-center px-1.5",
                    col.align === "right" && "justify-end text-right",
                    sticky.className,
                  )}
                  style={{
                    width: col.widthPx,
                    minWidth: col.widthPx,
                    maxWidth: col.widthPx,
                    ...sticky.style,
                  }}
                >
                  {col.header}
                </div>
              );
            })}
          </div>

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
                  rowWidth={rowWidth}
                  hasScrollRight={hasScrollRight}
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

      {hasScrollRight && (
        <div className="pointer-events-none absolute right-0 top-11 bottom-0 w-5 bg-gradient-to-l from-zinc-950/85 to-transparent" />
      )}

      {scrollState.max > 0 && (
        <div
          className={cn(
            "pointer-events-none absolute right-3 bottom-1 left-3 h-1.5 rounded bg-zinc-800/70 transition-opacity duration-200",
            showHorizontalIndicator || hasScrollLeft ? "opacity-100" : "opacity-0",
          )}
        >
          <div
            className="h-full rounded bg-zinc-500/80"
            style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbLeft}px)` }}
          />
        </div>
      )}
    </div>
  );
}

export default FlatFindingsTable;
