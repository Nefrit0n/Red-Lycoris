import { useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Flame, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
} from "@/api/saved-views";
import {
  DEFAULT_FINDINGS_FILTER,
  filterFromSearchParams,
  filterToSearchParams,
  filterCacheKey,
  isFilterEmpty,
  type FindingsFilter,
} from "@/lib/findings-filter";
import type { SavedView } from "@/types";
import { cn } from "@/lib/utils";

interface SavedViewsBarProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
}

const GROUP_OPTIONS: { value: FindingsFilter["groupBy"]; label: string }[] = [
  { value: "", label: "Без группировки" },
  { value: "component", label: "По компоненту" },
  { value: "rule", label: "По правилу" },
  { value: "cve", label: "По CVE" },
  { value: "secret", label: "По секрету" },
];

// Saved views are stored as a frozen URLSearchParams payload (a flat
// {key:value} dict). We materialize them through filterFromSearchParams so
// the shape stays consistent with the URL round-trip. Applying a view
// overwrites every field, including the ones the active filter already has,
// so clicking a view is always a "clean switch".
function paramsToRecord(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function recordToParams(rec: Record<string, unknown>): URLSearchParams {
  const p = new URLSearchParams();
  Object.entries(rec).forEach(([k, v]) => {
    if (typeof v === "string") p.set(k, v);
    else if (typeof v === "number") p.set(k, String(v));
    else if (typeof v === "boolean" && v) p.set(k, "true");
  });
  return p;
}

// Built-in views are read-only shortcuts for common triage intents. They
// live as static FindingsFilter patches so they always round-trip through
// the same URL serializer the user-saved views use. Each has a stable `key`
// used for active-state highlighting.
interface BuiltInView {
  key: string;
  name: string;
  icon: typeof Star;
  filter: FindingsFilter;
}

const BUILT_IN_VIEWS: BuiltInView[] = [
  {
    key: "kev-crit",
    name: "KEV + Критические",
    icon: Flame,
    filter: {
      ...DEFAULT_FINDINGS_FILTER,
      severities: [4],
      inKEV: true,
      sortField: "priority_score",
      sortDir: "desc",
    },
  },
  {
    key: "high-epss",
    name: "Высокий EPSS",
    icon: Star,
    filter: {
      ...DEFAULT_FINDINGS_FILTER,
      epssMin: 0.7,
      sortField: "priority_score",
      sortDir: "desc",
    },
  },
  {
    key: "new-open",
    name: "Новые за неделю",
    icon: Star,
    filter: {
      ...DEFAULT_FINDINGS_FILTER,
      statuses: [0],
      ageMaxDays: 7,
      sortField: "first_seen",
      sortDir: "desc",
    },
  },
  {
    key: "has-fix",
    name: "Есть фикс",
    icon: Star,
    filter: {
      ...DEFAULT_FINDINGS_FILTER,
      hasFix: true,
      severities: [3, 4],
      sortField: "priority_score",
      sortDir: "desc",
    },
  },
];

export function SavedViewsBar({ filter, onChange }: SavedViewsBarProps) {
  const { data, isLoading } = useSavedViews();
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  const [draftName, setDraftName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const views = data?.data ?? [];
  const activeKey = useMemo(() => filterCacheKey(filter), [filter]);

  const applyFilter = (next: FindingsFilter) => {
    // SavedViewsBar treats a view application as a full filter replacement
    // so we pass the whole patch to the parent, which is expected to merge
    // with DEFAULT_FINDINGS_FILTER on its end.
    onChange(next);
  };

  const applySavedView = (view: SavedView) => {
    const params = recordToParams(view.query);
    const next = filterFromSearchParams(params);
    applyFilter({ ...DEFAULT_FINDINGS_FILTER, ...next });
  };

  const saveCurrent = () => {
    const name = draftName.trim();
    if (!name) return;
    const query = paramsToRecord(filterToSearchParams(filter));
    createView.mutate(
      { name, query },
      {
        onSuccess: () => {
          setDraftName("");
          setSaveOpen(false);
        },
      },
    );
  };

  const canSave = !isFilterEmpty(filter);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/20 px-4 py-2">
      <Bookmark className="size-4 shrink-0 text-zinc-500" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Виды
      </span>

      <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-600">
          Группировка
        </span>
        {GROUP_OPTIONS.map((opt) => (
          <button
            key={`group-${opt.value || "none"}`}
            type="button"
            onClick={() => applyFilter({ ...filter, groupBy: opt.value })}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
              filter.groupBy === opt.value
                ? "border-red-700/60 bg-red-950/40 text-red-200"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
            )}
          >
            {opt.label}
          </button>
        ))}

        <div className="h-4 shrink-0 border-l border-zinc-800" />

        {BUILT_IN_VIEWS.map((view) => {
          const Icon = view.icon;
          const isActive = filterCacheKey(view.filter) === activeKey;
          return (
            <button
              key={view.key}
              type="button"
              onClick={() => applyFilter(view.filter)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                isActive
                  ? "border-red-700/60 bg-red-950/40 text-red-200"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
              )}
            >
              <Icon className="size-3" />
              {view.name}
            </button>
          );
        })}

        {BUILT_IN_VIEWS.length > 0 && (views.length > 0 || isLoading) && (
          <div className="h-4 shrink-0 border-l border-zinc-800" />
        )}

        {isLoading ? (
          <span className="shrink-0 text-xs text-zinc-600">Загрузка…</span>
        ) : (
          views.map((view) => (
            <div
              key={view.id}
              className="group flex shrink-0 items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 pl-2.5 pr-1 text-xs text-zinc-300 hover:border-zinc-700"
            >
              <button
                type="button"
                onClick={() => applySavedView(view)}
                className="max-w-[180px] truncate py-1 hover:text-zinc-100"
              >
                {view.name}
              </button>
              <Tooltip content="Удалить вид">
                <button
                  type="button"
                  onClick={() => deleteView.mutate(view.id)}
                  className={cn(
                    "rounded-full p-0.5 text-zinc-600 opacity-0 transition-opacity hover:bg-red-950/40 hover:text-red-400 group-hover:opacity-100",
                    deleteView.isPending && "opacity-100",
                  )}
                  aria-label="Удалить вид"
                >
                  <Trash2 className="size-3" />
                </button>
              </Tooltip>
            </div>
          ))
        )}
      </div>

      <DropdownMenu open={saveOpen} onOpenChange={setSaveOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={!canSave || createView.isPending}
              className="shrink-0 text-zinc-400 hover:text-zinc-200"
            >
              <BookmarkPlus className="size-3.5" />
              Сохранить
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-64 border-zinc-700 bg-zinc-900 p-2"
        >
          <div className="mb-1 px-1 text-xs text-zinc-500">Название вида</div>
          <Input
            autoFocus
            value={draftName}
            placeholder="Мои критические…"
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveCurrent();
              }
            }}
            className="h-8 border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
          />
          <Button
            size="sm"
            disabled={!draftName.trim() || createView.isPending}
            onClick={saveCurrent}
            className="mt-2 w-full bg-red-900/60 text-red-100 hover:bg-red-900"
          >
            Сохранить
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default SavedViewsBar;
