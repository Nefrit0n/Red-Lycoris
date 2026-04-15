import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import FiltersPanel from "@/components/findings/FiltersPanel";
import KindTabs from "@/components/findings/KindTabs";
import SavedViewsBar from "@/components/findings/SavedViewsBar";
import FindingsToolbar, {
  type Density,
} from "@/components/findings/FindingsToolbar";
import FlatFindingsTable from "@/components/findings/FlatFindingsTable";
import GroupedFindingsTable from "@/components/findings/GroupedFindingsTable";
import PreviewPanel from "@/components/findings/PreviewPanel";
import BulkActionsBar from "@/components/findings/BulkActionsBar";
import { useFindingsFacets } from "@/api/findings";
import {
  DEFAULT_FINDINGS_FILTER,
  filterFromSearchParams,
  filterToSearchParams,
  type FindingsFilter,
} from "@/lib/findings-filter";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useFindingsSelection } from "@/store/findings-selection";

// FindingsList is the page shell for the redesigned list — every piece of
// user state lives either in the URL (filter/sort/group), the preview
// selection, or localStorage (density). This keeps deep links shareable and
// the browser back-button behaving.
export default function FindingsList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = useMemo<FindingsFilter>(
    () => filterFromSearchParams(searchParams),
    [searchParams],
  );

  const updateFilter = useCallback(
    (update: Partial<FindingsFilter>) => {
      const next = { ...filter, ...update };
      setSearchParams(filterToSearchParams(next), { replace: true });
    },
    [filter, setSearchParams],
  );

  const [density, setDensity] = useLocalStorage<Density>(
    "rl_findings_density",
    "compact",
  );

  const [previewId, setPreviewId] = useState<string | null>(null);
  const selectedIds = useFindingsSelection((s) => s.selected);
  const toggleSelect = useFindingsSelection((s) => s.toggle);
  const clearSelection = useFindingsSelection((s) => s.clear);

  // Shared count/fetching state driven from the active table so the toolbar
  // can show a "15 342 находок" chip without owning the query itself.
  const [listMeta, setListMeta] = useState<{ total: number; fetching: boolean }>(
    { total: 0, fetching: false },
  );

  const { data: facetsData, refetch: refetchFacets } = useFindingsFacets(filter);
  const facets = facetsData?.data;

  const handleCountChange = useCallback((total: number, fetching: boolean) => {
    setListMeta((prev) =>
      prev.total === total && prev.fetching === fetching
        ? prev
        : { total, fetching },
    );
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchFacets();
  }, [refetchFacets]);

  // Keep preview + filter in sync: if the user closes a preview we also
  // drop any current bulk selection they might have started there.
  const closePreview = useCallback(() => setPreviewId(null), []);

  // Hotkeys: "/" focuses search, "Esc" closes the preview first and then
  // (on second press) clears the selection. The input ref is populated by
  // the FiltersPanel via onSearchRef.
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore "/" when the user is already typing in a field.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;

      if (e.key === "/" && !editable) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (previewId) {
          closePreview();
          return;
        }
        if (selectedIds.size > 0) {
          clearSelection();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId, selectedIds.size, closePreview, clearSelection]);

  const isGrouped = filter.groupBy !== "";

  return (
    <div className="flex h-[calc(100vh-6.5rem)] min-h-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
      <FiltersPanel
        filter={filter}
        onChange={updateFilter}
        facets={facets}
        onSearchRef={(el) => {
          searchInputRef.current = el;
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <KindTabs filter={filter} onChange={updateFilter} facets={facets} />

        <SavedViewsBar
          filter={filter}
          onChange={(update) => {
            // SavedViewsBar replaces the whole filter when applying a view;
            // it passes a complete patch already merged with DEFAULT.
            setSearchParams(
              filterToSearchParams({ ...DEFAULT_FINDINGS_FILTER, ...filter, ...update }),
              { replace: true },
            );
          }}
        />

        <FindingsToolbar
          filter={filter}
          onChange={updateFilter}
          total={listMeta.total}
          density={density}
          onDensityChange={setDensity}
          isFetching={listMeta.fetching}
          onRefresh={handleRefresh}
          selectedCount={selectedIds.size}
          onBulkStatusClick={() => undefined}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {isGrouped ? (
              <GroupedFindingsTable
                filter={filter}
                onRowClick={setPreviewId}
                onCountChange={handleCountChange}
              />
            ) : (
              <FlatFindingsTable
                filter={filter}
                density={density}
                onRowClick={setPreviewId}
                activeRowId={previewId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onCountChange={handleCountChange}
              />
            )}
          </div>

          {previewId && (
            <PreviewPanel
              findingId={previewId}
              onClose={closePreview}
              onPickProject={(projectId) =>
                updateFilter({ projectIds: [projectId] })
              }
            />
          )}
        </div>
      </div>
      <BulkActionsBar
        selected={selectedIds}
        onClear={clearSelection}
        projectId={filter.projectIds[0]}
      />
    </div>
  );
}
