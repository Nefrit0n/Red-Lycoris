import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import SeverityBadge from "@/components/findings/SeverityBadge";
import { statusMeta } from "@/lib/severity";
import {
  DEFAULT_FINDINGS_FILTER,
  type FindingsFilter,
} from "@/lib/findings-filter";
import type { FindingsFacets, FindingKind } from "@/types";
import { cn } from "@/lib/utils";

interface FiltersPanelProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
  facets?: FindingsFacets;
  onSearchRef?: (el: HTMLInputElement | null) => void;
}

const SEVERITY_LEVELS = [4, 3, 2, 1, 0];
const STATUS_LEVELS = [0, 1, 2, 3, 4];

// Age chips — each entry is {label, days}. The "all" sentinel clears the
// ageMaxDays filter.
const AGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Любой", days: null },
  { label: "24 часа", days: 1 },
  { label: "7 дней", days: 7 },
  { label: "30 дней", days: 30 },
  { label: "90 дней", days: 90 },
];

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
        className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {typeof count === "number" && (
        <span className="tabular-nums text-xs text-zinc-500">
          {count.toLocaleString("ru-RU")}
        </span>
      )}
    </label>
  );
}

function SwitchRow({
  checked,
  onChange,
  count,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-300",
        disabled && "opacity-50",
      )}
    >
      <Switch
        checked={checked}
        onCheckedChange={(v: boolean) => onChange(v)}
        disabled={disabled}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="tabular-nums text-xs text-zinc-500">
          {count.toLocaleString("ru-RU")}
        </span>
      )}
    </div>
  );
}

// toggleInArray keeps the filter arrays referentially stable when toggling
// doesn't actually change the set.
function toggleInArray<T>(current: T[], value: T, enabled: boolean): T[] {
  if (enabled) {
    return current.includes(value) ? current : [...current, value];
  }
  return current.filter((x) => x !== value);
}

// The panel is divided into Accordion sections so dense filter lists don't
// overwhelm the sidebar. We keep severity/status/enrichment open by default
// because they drive most triage flows.
const DEFAULT_OPEN = [
  "severity",
  "status",
  "enrichment",
  "thresholds",
];

export function FiltersPanel({
  filter,
  onChange,
  facets,
  onSearchRef,
}: FiltersPanelProps) {
  const [localQuery, setLocalQuery] = useState(filter.query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

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

  const severityCounts = useMemo(() => {
    const m = new Map<number, number>();
    facets?.by_severity?.forEach((b) => m.set(b.severity, b.count));
    return m;
  }, [facets]);

  const statusCounts = useMemo(() => {
    const m = new Map<number, number>();
    facets?.by_status?.forEach((b) => m.set(b.status, b.count));
    return m;
  }, [facets]);

  const projectFacets = facets?.by_project ?? [];
  const visibleProjects = showAllProjects
    ? projectFacets
    : projectFacets.slice(0, 20);

  const sourceFacets = facets?.by_source ?? [];
  const ecosystemFacets = facets?.by_ecosystem ?? [];
  const iacProviderFacets = facets?.by_iac_provider ?? [];
  const secretKindFacets = facets?.by_secret_kind ?? [];

  // Determine which single kind is active — contextual filter sections are
  // shown only when the user has scoped to exactly that kind.
  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;

  const hasActive =
    filter.severities.length > 0 ||
    filter.statuses.length > 0 ||
    filter.kinds.length > 0 ||
    filter.projectIds.length > 0 ||
    filter.sources.length > 0 ||
    filter.ecosystems.length > 0 ||
    filter.iacProviders.length > 0 ||
    filter.secretKinds.length > 0 ||
    filter.query.trim().length > 0 ||
    filter.hasCVE ||
    filter.hasFix ||
    filter.inKEV ||
    filter.inBDU ||
    filter.epssMin !== null ||
    filter.cvssMin !== null ||
    filter.ageMaxDays !== null;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-zinc-800">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Фильтры
        </span>
        {hasActive && (
          <Button
            variant="ghost"
            size="xs"
            className="h-6 px-1.5 text-xs text-zinc-500 hover:text-zinc-200"
            onClick={() => onChange({ ...DEFAULT_FINDINGS_FILTER })}
          >
            <X className="size-3" />
            Очистить всё
          </Button>
        )}
      </div>

      <div className="px-4 pb-2">
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
      </div>

      <Accordion
        multiple
        defaultValue={DEFAULT_OPEN}
        className="flex-1 px-4"
      >
        <AccordionItem value="severity">
          <AccordionHeader>
            <AccordionTrigger>Критичность</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="space-y-0.5">
              {SEVERITY_LEVELS.map((level) => (
                <CheckboxRow
                  key={level}
                  checked={filter.severities.includes(level)}
                  count={severityCounts.get(level)}
                  onChange={(enabled) =>
                    onChange({
                      severities: toggleInArray(
                        filter.severities,
                        level,
                        enabled,
                      ),
                    })
                  }
                >
                  <SeverityBadge severity={level} />
                </CheckboxRow>
              ))}
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="status">
          <AccordionHeader>
            <AccordionTrigger>Статус</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="space-y-0.5">
              {STATUS_LEVELS.map((level) => {
                const meta = statusMeta(level);
                return (
                  <CheckboxRow
                    key={level}
                    checked={filter.statuses.includes(level)}
                    count={statusCounts.get(level)}
                    onChange={(enabled) =>
                      onChange({
                        statuses: toggleInArray(
                          filter.statuses,
                          level,
                          enabled,
                        ),
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
                  </CheckboxRow>
                );
              })}
            </div>
          </AccordionPanel>
        </AccordionItem>

        {projectFacets.length > 0 && (
          <AccordionItem value="project">
            <AccordionHeader>
              <AccordionTrigger>Проекты</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-0.5">
                {visibleProjects.map((p) => (
                  <CheckboxRow
                    key={p.id}
                    checked={filter.projectIds.includes(p.id)}
                    count={p.count}
                    onChange={(enabled) =>
                      onChange({
                        projectIds: toggleInArray(
                          filter.projectIds,
                          p.id,
                          enabled,
                        ),
                      })
                    }
                  >
                    <span className="truncate text-zinc-300">{p.name}</span>
                  </CheckboxRow>
                ))}
                {projectFacets.length > 20 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1 h-6 w-full justify-start px-2 text-xs text-zinc-500 hover:text-zinc-200"
                    onClick={() => setShowAllProjects((v) => !v)}
                  >
                    {showAllProjects
                      ? "Свернуть"
                      : `Показать все (${projectFacets.length})`}
                  </Button>
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}

        {sourceFacets.length > 0 && (
          <AccordionItem value="source">
            <AccordionHeader>
              <AccordionTrigger>Источник</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-0.5">
                {sourceFacets.map((s) => (
                  <CheckboxRow
                    key={s.value}
                    checked={filter.sources.includes(s.value)}
                    count={s.count}
                    onChange={(enabled) =>
                      onChange({
                        sources: toggleInArray(
                          filter.sources,
                          s.value,
                          enabled,
                        ),
                      })
                    }
                  >
                    <span className="truncate text-zinc-300">{s.value}</span>
                  </CheckboxRow>
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}

        <AccordionItem value="enrichment">
          <AccordionHeader>
            <AccordionTrigger>Обогащение</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="space-y-0.5">
              <SwitchRow
                checked={filter.inKEV}
                count={facets?.enrichment?.in_kev}
                label="Только в KEV (CISA)"
                onChange={(v) => onChange({ inKEV: v })}
              />
              <SwitchRow
                checked={filter.inBDU}
                count={facets?.enrichment?.in_bdu}
                label="В БДУ ФСТЭК"
                onChange={(v) => onChange({ inBDU: v })}
              />
              <SwitchRow
                checked={filter.hasCVE}
                count={facets?.enrichment?.has_cve}
                label="Есть CVE"
                onChange={(v) => onChange({ hasCVE: v })}
              />
              {activeKind === "sca" && (
                <SwitchRow
                  checked={filter.hasFix}
                  count={facets?.enrichment?.has_fix}
                  label="Есть фикс"
                  onChange={(v) => onChange({ hasFix: v })}
                />
              )}
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="thresholds">
          <AccordionHeader>
            <AccordionTrigger>Пороги</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="space-y-4 py-1">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>EPSS ≥</span>
                  <span className="tabular-nums text-zinc-200">
                    {(filter.epssMin ?? 0).toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={filter.epssMin ?? 0}
                  onValueChange={(v) =>
                    onChange({ epssMin: v === 0 ? null : Number(v.toFixed(2)) })
                  }
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>CVSS ≥</span>
                  <span className="tabular-nums text-zinc-200">
                    {(filter.cvssMin ?? 0).toFixed(1)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.5}
                  value={filter.cvssMin ?? 0}
                  onValueChange={(v) =>
                    onChange({ cvssMin: v === 0 ? null : Number(v.toFixed(1)) })
                  }
                />
              </div>
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="age">
          <AccordionHeader>
            <AccordionTrigger>Возраст</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="flex flex-wrap gap-1.5 py-1">
              {AGE_OPTIONS.map((opt) => {
                const active =
                  (opt.days === null && filter.ageMaxDays === null) ||
                  opt.days === filter.ageMaxDays;
                return (
                  <Button
                    key={opt.label}
                    size="xs"
                    variant={active ? "default" : "outline"}
                    className={cn(
                      "h-6",
                      active
                        ? "border-red-700/60 bg-red-950/60 text-red-200"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200",
                    )}
                    onClick={() => onChange({ ageMaxDays: opt.days })}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </AccordionPanel>
        </AccordionItem>

        {activeKind === "sca" && ecosystemFacets.length > 0 && (
          <AccordionItem value="ecosystem">
            <AccordionHeader>
              <AccordionTrigger>Экосистема</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-0.5">
                {ecosystemFacets.map((s) => (
                  <CheckboxRow
                    key={s.value}
                    checked={filter.ecosystems.includes(s.value)}
                    count={s.count}
                    onChange={(enabled) =>
                      onChange({
                        ecosystems: toggleInArray(
                          filter.ecosystems,
                          s.value,
                          enabled,
                        ),
                      })
                    }
                  >
                    <span className="truncate text-zinc-300">{s.value}</span>
                  </CheckboxRow>
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}

        {activeKind === "iac" && iacProviderFacets.length > 0 && (
          <AccordionItem value="iac-provider">
            <AccordionHeader>
              <AccordionTrigger>Провайдер IaC</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-0.5">
                {iacProviderFacets.map((s) => (
                  <CheckboxRow
                    key={s.value}
                    checked={filter.iacProviders.includes(s.value)}
                    count={s.count}
                    onChange={(enabled) =>
                      onChange({
                        iacProviders: toggleInArray(
                          filter.iacProviders,
                          s.value,
                          enabled,
                        ),
                      })
                    }
                  >
                    <span className="truncate text-zinc-300">{s.value}</span>
                  </CheckboxRow>
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}

        {activeKind === "secrets" && secretKindFacets.length > 0 && (
          <AccordionItem value="secret-kind">
            <AccordionHeader>
              <AccordionTrigger>Тип секрета</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-0.5">
                {secretKindFacets.map((s) => (
                  <CheckboxRow
                    key={s.value}
                    checked={filter.secretKinds.includes(s.value)}
                    count={s.count}
                    onChange={(enabled) =>
                      onChange({
                        secretKinds: toggleInArray(
                          filter.secretKinds,
                          s.value,
                          enabled,
                        ),
                      })
                    }
                  >
                    <span className="truncate text-zinc-300">{s.value}</span>
                  </CheckboxRow>
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}
      </Accordion>
    </aside>
  );
}

export default FiltersPanel;
