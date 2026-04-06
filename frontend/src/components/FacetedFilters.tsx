import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import { useFiltersStore } from "@/store/filters";
import { cn } from "@/lib/utils";

interface FacetCounts {
  severity: Record<number, number>;
  status: Record<number, number>;
}

interface FacetedFiltersProps {
  counts?: FacetCounts;
}

const severityLevels = [4, 3, 2, 1, 0] as const;
const statusLevels = [0, 1, 2, 3, 4] as const;

function CheckboxRow({
  checked,
  onChange,
  count,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/50",
        checked && "bg-zinc-800/40",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
      />
      <span className="flex-1">{children}</span>
      {count !== undefined && (
        <span className="tabular-nums text-xs text-zinc-500">{count}</span>
      )}
    </label>
  );
}

export default function FacetedFilters({ counts }: FacetedFiltersProps) {
  const {
    severities,
    statuses,
    query,
    setSeverities,
    setStatuses,
    setQuery,
    resetFilters,
  } = useFiltersStore();

  const [localQuery, setLocalQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedSetQuery = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setQuery(value), 300);
    },
    [setQuery],
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const toggleSeverity = (sev: number, on: boolean) => {
    setSeverities(
      on ? [...severities, sev] : severities.filter((s) => s !== sev),
    );
  };

  const toggleStatus = (st: number, on: boolean) => {
    setStatuses(on ? [...statuses, st] : statuses.filter((s) => s !== st));
  };

  const hasActiveFilters =
    severities.length > 0 || statuses.length > 0 || query.length > 0;

  return (
    <div className="flex w-70 shrink-0 flex-col gap-4 overflow-y-auto pr-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Поиск находок..."
          value={localQuery}
          onChange={(e) => {
            setLocalQuery(e.target.value);
            debouncedSetQuery(e.target.value);
          }}
          className="h-8 border-zinc-800 bg-zinc-900 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-red-700/40"
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          КРИТИЧНОСТЬ
        </h3>
        <div className="space-y-0.5">
          {severityLevels.map((sev) => (
            <CheckboxRow
              key={sev}
              checked={severities.includes(sev)}
              onChange={(on) => toggleSeverity(sev, on)}
              count={counts?.severity[sev]}
            >
              <SeverityBadge severity={sev} />
            </CheckboxRow>
          ))}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          СТАТУС
        </h3>
        <div className="space-y-0.5">
          {statusLevels.map((st) => (
            <CheckboxRow
              key={st}
              checked={statuses.includes(st)}
              onChange={(on) => toggleStatus(st, on)}
              count={counts?.status[st]}
            >
              <StatusBadge status={st} />
            </CheckboxRow>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <>
          <Separator className="bg-zinc-800" />
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="w-full text-zinc-400 hover:text-zinc-200"
          >
            <X className="size-3.5" />
            Сбросить фильтры
          </Button>
        </>
      )}
    </div>
  );
}
