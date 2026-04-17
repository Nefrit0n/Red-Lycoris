import {
  ArrowDownUp,
  Columns3,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  FindingsPreset,
} from "@/components/findings/findingsTableConfig";
import type { BulkStatusOption } from "@/components/findings/BulkStatusCommentDialog";
import { PRESET_LABEL } from "@/components/findings/findingsTableConfig";
import type { FindingsFilter, SortField } from "@/lib/findings-filter";
import { cn } from "@/lib/utils";

interface FindingsToolbarProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
  total?: number;
  preset: FindingsPreset;
  onPresetChange: (preset: Exclude<FindingsPreset, "custom">) => void;
  onOpenColumnChooser: () => void;
  isFetching?: boolean;
  onRefresh?: () => void;
  selectedCount?: number;
  onBulkStatusSelect?: (statusKey: BulkStatusOption) => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "first_seen", label: "Обнаружено" },
  { value: "last_seen", label: "Последний раз" },
  { value: "severity", label: "Критичность" },
  { value: "priority_score", label: "Приоритет" },
];

export function FindingsToolbar({
  filter,
  onChange,
  total,
  preset,
  onPresetChange,
  onOpenColumnChooser,
  isFetching,
  onRefresh,
  selectedCount = 0,
  onBulkStatusSelect,
}: FindingsToolbarProps) {
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === filter.sortField)?.label ??
    "Обнаружено";
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
        {selectedCount > 0 && onBulkStatusSelect && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 bg-zinc-900 text-zinc-300"
                >
                  Сменить статус
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="border-zinc-700 bg-zinc-900"
            >
              <DropdownMenuItem
                onClick={() => onBulkStatusSelect("open")}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Открыто
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkStatusSelect("confirmed")}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Подтверждено
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkStatusSelect("false_positive")}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Ложное
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkStatusSelect("fixed")}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Исправлено
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkStatusSelect("accepted_risk")}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Принят риск
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-200"
              >
                <Columns3 className="size-4" />
                {PRESET_LABEL[preset]}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="border-zinc-700 bg-zinc-900">
            {(["triage", "engineering", "compliance", "full"] as const).map((presetValue) => (
              <DropdownMenuItem
                key={presetValue}
                onClick={() => onPresetChange(presetValue)}
                className={cn(
                  "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100",
                  preset === presetValue && "bg-zinc-800/60",
                )}
              >
                {PRESET_LABEL[presetValue]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem
              onClick={onOpenColumnChooser}
              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
            >
              Настроить колонки...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
