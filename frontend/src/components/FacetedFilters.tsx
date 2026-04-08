import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import { useFiltersStore } from "@/store/filters";
import { cn } from "@/lib/utils";

interface FacetCounts {
  severity?: Record<number, number>;
  status?: Record<number, number>;
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
  children: ReactNode;
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
        className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-violet-500"
      />
      <span className="flex-1">{children}</span>
      {typeof count === "number" && (
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

  const safeSeverities = severities ?? [];
  const safeStatuses = statuses ?? [];
  const safeQuery = query ?? "";

  const [localQuery, setLocalQuery] = useState(safeQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const severityCounts = counts?.severity ?? {};
  const statusCounts = counts?.status ?? {};

  const debouncedSetQuery = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setQuery(value);
      }, 300);
    },
    [setQuery],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLocalQuery(safeQuery);
  }, [safeQuery]);

  const toggleSeverity = useCallback(
    (severity: number, enabled: boolean) => {
      const next = enabled
        ? Array.from(new Set([...safeSeverities, severity])).sort((a, b) => b - a)
        : safeSeverities.filter((value) => value !== severity);

      setSeverities(next);
    },
    [safeSeverities, setSeverities],
  );

  const toggleStatus = useCallback(
    (status: number, enabled: boolean) => {
      const next = enabled
        ? Array.from(new Set([...safeStatuses, status])).sort((a, b) => a - b)
        : safeStatuses.filter((value) => value !== status);

      setStatuses(next);
    },
    [safeStatuses, setStatuses],
  );

  const hasActiveFilters = useMemo(() => {
    return (
      safeSeverities.length > 0 ||
      safeStatuses.length > 0 ||
      safeQuery.trim().length > 0
    );
  }, [safeSeverities, safeStatuses, safeQuery]);

  const handleReset = useCallback(() => {
    setLocalQuery("");
    resetFilters();
  }, [resetFilters]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto pr-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search findings..."
          value={localQuery}
          onChange={(e) => {
            const value = e.target.value;
            setLocalQuery(value);
            debouncedSetQuery(value);
          }}
          className="h-8 border-zinc-800 bg-zinc-900 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-violet-600/40"
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Severity
        </h3>
        <div className="space-y-0.5">
          {severityLevels.map((severity) => (
            <CheckboxRow
              key={severity}
              checked={safeSeverities.includes(severity)}
              onChange={(enabled) => toggleSeverity(severity, enabled)}
              count={severityCounts[severity]}
            >
              <SeverityBadge severity={severity} />
            </CheckboxRow>
          ))}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Status
        </h3>
        <div className="space-y-0.5">
          {statusLevels.map((status) => (
            <CheckboxRow
              key={status}
              checked={safeStatuses.includes(status)}
              onChange={(enabled) => toggleStatus(status, enabled)}
              count={statusCounts[status]}
            >
              <StatusBadge status={status} />
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
            onClick={handleReset}
            className="w-full text-zinc-400 hover:text-zinc-200"
          >
            <X className="size-3.5" />
            Reset filters
          </Button>
        </>
      )}
    </aside>
  );
}