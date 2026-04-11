import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";

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
  isFilterEmpty,
  type FindingsFilter,
} from "@/lib/findings-filter";
import type { SavedView } from "@/types";
import { cn } from "@/lib/utils";

interface SavedViewsBarProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
}

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

export function SavedViewsBar({ filter, onChange }: SavedViewsBarProps) {
  const { data, isLoading } = useSavedViews();
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  const [draftName, setDraftName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const views = data?.data ?? [];

  const applyView = (view: SavedView) => {
    const params = recordToParams(view.query);
    const next = filterFromSearchParams(params);
    onChange({ ...DEFAULT_FINDINGS_FILTER, ...next });
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
      <Bookmark className="size-4 text-zinc-500" />
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Сохранённые виды
      </span>

      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {isLoading ? (
          <span className="text-xs text-zinc-600">Загрузка…</span>
        ) : views.length === 0 ? (
          <span className="text-xs text-zinc-600">Ещё нет сохранённых видов</span>
        ) : (
          views.map((view) => (
            <div
              key={view.id}
              className="group flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 pl-2.5 pr-1 text-xs text-zinc-300 hover:border-zinc-700"
            >
              <button
                type="button"
                onClick={() => applyView(view)}
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
              className="text-zinc-400 hover:text-zinc-200"
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
          <div className="mb-1 px-1 text-xs text-zinc-500">
            Название вида
          </div>
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
