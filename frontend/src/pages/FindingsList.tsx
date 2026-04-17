import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useHotkey } from "@/hooks/use-hotkey";

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
    "findings.density",
    "comfortable",
  );

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const selectedIds = useFindingsSelection((s) => s.selected);
  const toggleSelect = useFindingsSelection((s) => s.toggle);
  const addManyToSelection = useFindingsSelection((s) => s.addMany);
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
  const closePreview = useCallback(() => {
    setPreviewId(null);
    previewTriggerRef.current?.focus();
  }, []);

  const openPreview = useCallback((id: string, triggerEl?: HTMLElement | null) => {
    previewTriggerRef.current = triggerEl ?? null;
    setPreviewId(id);
  }, []);

  // Hotkeys: "/" focuses search, "Esc" clears multi-selection. Preview close
  // is handled in the drawer component itself so it works even when focus is
  // trapped inside the dialog.
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useHotkey("/", (event) => {
    event.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkey(
    "Escape",
    () => {
      if (selectedIds.size > 0) {
        clearSelection();
      }
    },
    { allowInEditable: true },
  );

  const isGrouped = filter.groupBy !== "";
  const hasActiveFilters =
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
    filter.ageMaxDays !== null ||
    filter.assigneeMe ||
    filter.unassigned ||
    filter.assignees.length > 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
      <FiltersPanel
        filter={filter}
        onChange={updateFilter}
        facets={facets}
        onSearchRef={(el) => {
          searchInputRef.current = el;
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <KindTabs filter={filter} onChange={updateFilter} facets={facets} />

        <SavedViewsBar
          filter={filter}
          onChange={(update) => {
            // SavedViewsBar hands us a complete FindingsFilter when applying
            // a view — the spread with DEFAULT is a belt-and-braces guard for
            // forward-compat fields the view payload might not carry yet.
            setSearchParams(
              filterToSearchParams({ ...DEFAULT_FINDINGS_FILTER, ...update }),
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

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {isGrouped ? (
              <GroupedFindingsTable
                filter={filter}
                density={density}
                onRowClick={openPreview}
                onCountChange={handleCountChange}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={() =>
                  setSearchParams(filterToSearchParams(DEFAULT_FINDINGS_FILTER), {
                    replace: true,
                  })
                }
              />
            ) : (
              <FlatFindingsTable
                filter={filter}
                density={density}
                onRowClick={openPreview}
                activeRowId={previewId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectRange={addManyToSelection}
                onCountChange={handleCountChange}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={() =>
                  setSearchParams(filterToSearchParams(DEFAULT_FINDINGS_FILTER), {
                    replace: true,
                  })
                }
              />
            )}
          </div>

        </div>
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
      <BulkActionsBar
        selected={selectedIds}
        onClear={clearSelection}
        projectId={filter.projectIds[0]}
      />
    </div>
  );
}
