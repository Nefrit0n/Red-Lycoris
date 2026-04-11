import {
  ArrowDownUp,
  Group,
  Loader2,
  Rows2,
  Rows3,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { FindingsFilter, GroupBy, SortField } from "@/lib/findings-filter";
import { cn } from "@/lib/utils";

export type Density = "compact" | "comfortable";

interface FindingsToolbarProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
  total?: number;
  density: Density;
  onDensityChange: (d: Density) => void;
  isFetching?: boolean;
  onRefresh?: () => void;
  selectedCount?: number;
  onBulkStatusClick?: () => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "first_seen", label: "Обнаружено" },
  { value: "last_seen", label: "Последний раз" },
  { value: "severity", label: "Критичность" },
  { value: "priority_score", label: "Приоритет" },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "", label: "Без группировки" },
  { value: "cve", label: "По CVE" },
  { value: "component", label: "По компоненту" },
  { value: "rule", label: "По правилу" },
];

export function FindingsToolbar({
  filter,
  onChange,
  total,
  density,
  onDensityChange,
  isFetching,
  onRefresh,
  selectedCount = 0,
  onBulkStatusClick,
}: FindingsToolbarProps) {
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === filter.sortField)?.label ??
    "Обнаружено";
  const groupLabel =
    GROUP_OPTIONS.find((o) => o.value === filter.groupBy)?.label ??
    "Без группировки";

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/20 px-4 py-2">
      <div className="flex min-w-0 items-center gap-3 text-sm text-zinc-400">
        {typeof total === "number" && (
          <span>
            <span className="font-medium text-zinc-200">
              {total.toLocaleString("ru-RU")}
            </span>{" "}
            находок
          </span>
        )}
        {selectedCount > 0 && (
          <span className="text-red-400">{selectedCount} выбрано</span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        {selectedCount > 0 && onBulkStatusClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkStatusClick}
            className="border-zinc-700 bg-zinc-900 text-zinc-300"
          >
            Сменить статус
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-200"
              >
                <Group className="size-4" />
                {groupLabel}
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="border-zinc-700 bg-zinc-900"
          >
            {GROUP_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value || "none"}
                onClick={() => onChange({ groupBy: opt.value })}
                className={cn(
                  "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100",
                  filter.groupBy === opt.value && "bg-zinc-800/60",
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-200"
              >
                <ArrowDownUp className="size-4" />
                {sortLabel} {filter.sortDir === "desc" ? "↓" : "↑"}
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="border-zinc-700 bg-zinc-900"
          >
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() =>
                  onChange({
                    sortField: opt.value,
                    sortDir:
                      filter.sortField === opt.value &&
                      filter.sortDir === "desc"
                        ? "asc"
                        : "desc",
                  })
                }
                className={cn(
                  "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100",
                  filter.sortField === opt.value && "bg-zinc-800/60",
                )}
              >
                {opt.label}{" "}
                {filter.sortField === opt.value
                  ? filter.sortDir === "desc"
                    ? "↓"
                    : "↑"
                  : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip
          content={
            density === "compact"
              ? "Комфортный режим"
              : "Компактный режим"
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              onDensityChange(density === "compact" ? "comfortable" : "compact")
            }
            className="text-zinc-400 hover:text-zinc-200"
          >
            {density === "compact" ? (
              <Rows2 className="size-4" />
            ) : (
              <Rows3 className="size-4" />
            )}
          </Button>
        </Tooltip>

        {onRefresh && (
          <Tooltip content="Обновить">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isFetching}
              onClick={onRefresh}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default FindingsToolbar;
