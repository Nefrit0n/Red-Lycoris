import { useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import { useFiltersStore } from "@/store/filters";
import type { Finding } from "@/types";
import { cn } from "@/lib/utils";

const col = createColumnHelper<Finding>();

function SortIcon({ field }: { field: string }) {
  const { sortField, sortDir } = useFiltersStore();
  if (sortField !== field) return <ArrowUpDown className="size-3.5 text-zinc-600" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3.5 text-red-500" />
  ) : (
    <ArrowDown className="size-3.5 text-red-500" />
  );
}

interface FindingsTableProps {
  findings: Finding[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

const ROW_HEIGHT = 44;

export default function FindingsTable({
  findings,
  isLoading,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  allSelected,
}: FindingsTableProps) {
  const navigate = useNavigate();
  const { sortField, sortDir, setSort } = useFiltersStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSort(field, sortDir === "asc" ? "desc" : "asc");
      } else {
        setSort(field, "desc");
      }
    },
    [sortField, sortDir, setSort],
  );

  const columns = useMemo(
    () => [
      col.display({
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected && findings.length > 0}
            onChange={onToggleAll}
            className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(row.original.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
          />
        ),
        size: 40,
      }),
      col.accessor("severity", {
        header: "Критичность",
        cell: (info) => <SeverityBadge severity={info.getValue()} />,
        size: 100,
      }),
      col.accessor("title", {
        header: "Название",
        cell: (info) => (
          <span className="line-clamp-1 text-zinc-200">{info.getValue()}</span>
        ),
        size: 320,
      }),
      col.accessor("component", {
        header: "Компонент",
        cell: (info) => (
          <span className="line-clamp-1 font-mono text-xs text-zinc-400">
            {info.getValue() ?? "\u2014"}
          </span>
        ),
        size: 160,
      }),
      col.accessor("file_path", {
        header: "Файл",
        cell: (info) => (
          <span className="line-clamp-1 font-mono text-xs text-zinc-500">
            {info.getValue() ?? "\u2014"}
          </span>
        ),
        size: 200,
      }),
      col.accessor("status", {
        header: "Статус",
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 120,
      }),
      col.accessor("priority_score", {
        header: "Приоритет",
        cell: (info) => {
          const v = info.getValue();
          if (v == null) return <span className="text-zinc-600">\u2014</span>;
          return (
            <span
              className={cn(
                "font-mono text-sm font-medium",
                v >= 8
                  ? "text-red-400"
                  : v >= 5
                    ? "text-orange-400"
                    : "text-zinc-400",
              )}
            >
              {v.toFixed(1)}
            </span>
          );
        },
        size: 80,
      }),
      col.accessor("first_seen", {
        header: "Обнаружено",
        cell: (info) => (
          <span className="text-xs text-zinc-500">
            {formatDistanceToNow(new Date(info.getValue()), {
              addSuffix: true,
              locale: ru,
            })}
          </span>
        ),
        size: 120,
      }),
      col.accessor("times_seen", {
        header: "Кол-во",
        cell: (info) => (
          <span className="font-mono text-xs text-zinc-400">
            {info.getValue()}
          </span>
        ),
        size: 60,
      }),
    ],
    [allSelected, findings.length, onToggleAll, onToggleSelect, selectedIds],
  );

  const table = useReactTable({
    data: findings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const sortableFields = new Set([
    "severity",
    "priority_score",
    "first_seen",
    "times_seen",
    "status",
    "title",
  ]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-zinc-800/50" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto rounded-lg border border-zinc-800"
    >
      <div style={{ minWidth: 1200 }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
          {table.getHeaderGroups().map((hg) =>
            hg.headers.map((header) => {
              const isSortable = sortableFields.has(header.id);
              return (
                <div
                  key={header.id}
                  className={cn(
                    "flex shrink-0 items-center gap-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500",
                    isSortable && "cursor-pointer select-none hover:text-zinc-300",
                  )}
                  style={{ width: header.getSize() }}
                  onClick={isSortable ? () => handleSort(header.id) : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {isSortable && <SortIcon field={header.id} />}
                </div>
              );
            }),
          )}
        </div>

        {/* Virtualized rows */}
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index];
            const isSelected = selectedIds.has(row.original.id);
            return (
              <div
                key={row.id}
                className={cn(
                  "absolute inset-x-0 flex cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40",
                  isSelected && "bg-red-950/20",
                )}
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${vRow.start}px)`,
                }}
                onClick={() => navigate(`/findings/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="flex shrink-0 items-center px-3"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {findings.length === 0 && !isLoading && (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
            Нет находок, соответствующих текущим фильтрам.
          </div>
        )}
      </div>
    </div>
  );
}
