import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { statusMeta } from "@/lib/severity";
import {
  DEFAULT_FINDINGS_FILTER,
  type FindingsFilter,
} from "@/lib/findings-filter";
import type { FindingsFacets } from "@/types";
import { cn } from "@/lib/utils";

interface FiltersPanelProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
  facets?: FindingsFacets;
  onSearchRef?: (el: HTMLInputElement | null) => void;
}

const SEVERITY_LEVELS = [4, 3, 2, 1, 0];
const STATUS_LEVELS = [0, 1, 2, 3, 4];

function CountedRow({
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
        className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
      />
      <span className="flex-1">{children}</span>
      {typeof count === "number" && (
        <span className="tabular-nums text-xs text-zinc-500">
          {count.toLocaleString("ru-RU")}
        </span>
      )}
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  count,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  label: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50",
        checked && "bg-zinc-800/40",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
      />
      <span className="flex-1">{label}</span>
      {typeof count === "number" && (
        <span className="tabular-nums text-xs text-zinc-500">
          {count.toLocaleString("ru-RU")}
        </span>
      )}
    </label>
  );
}

export function FiltersPanel({
  filter,
  onChange,
  facets,
  onSearchRef,
}: FiltersPanelProps) {
  const [localQuery, setLocalQuery] = useState(filter.query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the local input in sync when the URL drives a new filter (e.g.
  // saved view applied).
  useEffect(() => {
    setLocalQuery(filter.query);
  }, [filter.query]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const debounceSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ query: value });
      }, 300);
    },
    [onChange],
  );

  const toggleInArray = <T,>(
    current: T[],
    value: T,
    enabled: boolean,
  ): T[] => {
    if (enabled) {
      return current.includes(value) ? current : [...current, value];
    }
    return current.filter((x) => x !== value);
  };

  const severityCounts = new Map<number, number>();
  facets?.by_severity?.forEach((b) => severityCounts.set(b.severity, b.count));

  const statusCounts = new Map<number, number>();
  facets?.by_status?.forEach((b) => statusCounts.set(b.status, b.count));

  const hasActive =
    filter.severities.length > 0 ||
    filter.statuses.length > 0 ||
    filter.kinds.length > 0 ||
    filter.projectIds.length > 0 ||
    filter.query.trim().length > 0 ||
    filter.hasCVE ||
    filter.hasFix ||
    filter.inKEV ||
    filter.inBDU ||
    filter.epssMin !== null ||
    filter.cvssMin !== null ||
    filter.ageMaxDays !== null;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 px-4 py-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          ref={(el) => onSearchRef?.(el)}
          placeholder="Поиск… (/)"
          value={localQuery}
          onChange={(e) => {
            setLocalQuery(e.target.value);
            debounceSearch(e.target.value);
          }}
          className="h-8 border-zinc-800 bg-zinc-900 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-red-700/40"
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Критичность
        </h3>
        <div className="space-y-0.5">
          {SEVERITY_LEVELS.map((level) => (
            <CountedRow
              key={level}
              checked={filter.severities.includes(level)}
              count={severityCounts.get(level)}
              onChange={(enabled) =>
                onChange({
                  severities: toggleInArray(filter.severities, level, enabled),
                })
              }
            >
              <SeverityBadge severity={level} />
            </CountedRow>
          ))}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Статус
        </h3>
        <div className="space-y-0.5">
          {STATUS_LEVELS.map((level) => {
            const meta = statusMeta(level);
            return (
              <CountedRow
                key={level}
                checked={filter.statuses.includes(level)}
                count={statusCounts.get(level)}
                onChange={(enabled) =>
                  onChange({
                    statuses: toggleInArray(filter.statuses, level, enabled),
                  })
                }
              >
                <span
                  className={cn(
                    "inline-block rounded-md border px-2 py-0.5 text-xs",
                    meta.badgeClass,
                  )}
                >
                  {meta.label}
                </span>
              </CountedRow>
            );
          })}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Обогащение
        </h3>
        <div className="space-y-0.5">
          <ToggleRow
            checked={filter.inKEV}
            count={facets?.enrichment?.in_kev}
            label="В KEV (CISA)"
            onChange={(v) => onChange({ inKEV: v })}
          />
          <ToggleRow
            checked={filter.inBDU}
            count={facets?.enrichment?.in_bdu}
            label="В БДУ ФСТЭК"
            onChange={(v) => onChange({ inBDU: v })}
          />
          <ToggleRow
            checked={filter.hasCVE}
            count={facets?.enrichment?.has_cve}
            label="Есть CVE"
            onChange={(v) => onChange({ hasCVE: v })}
          />
          <ToggleRow
            checked={filter.hasFix}
            count={facets?.enrichment?.has_fix}
            label="Есть исправление"
            onChange={(v) => onChange({ hasFix: v })}
          />
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Пороги
        </h3>
        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            EPSS ≥
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={filter.epssMin ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange({ epssMin: null });
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0 && n <= 1) {
                  onChange({ epssMin: n });
                }
              }}
              className="h-7 border-zinc-800 bg-zinc-900 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            CVSS ≥
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={filter.cvssMin ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange({ cvssMin: null });
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0 && n <= 10) {
                  onChange({ cvssMin: n });
                }
              }}
              className="h-7 border-zinc-800 bg-zinc-900 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Возраст ≤ дней
            <Input
              type="number"
              min={1}
              step={1}
              value={filter.ageMaxDays ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange({ ageMaxDays: null });
                  return;
                }
                const n = Number(raw);
                if (Number.isInteger(n) && n > 0) {
                  onChange({ ageMaxDays: n });
                }
              }}
              className="h-7 border-zinc-800 bg-zinc-900 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
          </label>
        </div>
      </div>

      {hasActive && (
        <>
          <Separator className="bg-zinc-800" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-zinc-400 hover:text-zinc-200"
            onClick={() => onChange({ ...DEFAULT_FINDINGS_FILTER })}
          >
            <X className="size-3.5" />
            Сбросить фильтры
          </Button>
        </>
      )}
    </aside>
  );
}

export default FiltersPanel;
