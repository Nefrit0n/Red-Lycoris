import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useHotkey } from "@/hooks/use-hotkey";

import FiltersPanel from "@/components/findings/FiltersPanel";
import KindTabs from "@/components/findings/KindTabs";
import SavedViewsBar from "@/components/findings/SavedViewsBar";
import FindingsToolbar from "@/components/findings/FindingsToolbar";
import FlatFindingsTable from "@/components/findings/FlatFindingsTable";
import PreviewPanel from "@/components/findings/PreviewPanel";
import BulkActionsBar from "@/components/findings/BulkActionsBar";
import ColumnChooser from "@/components/findings/ColumnChooser";
import { useFindingsFacets } from "@/api/findings";
import {
  DEFAULT_FINDINGS_FILTER,
  filterFromSearchParams,
  filterToSearchParams,
  type FindingsFilter,
} from "@/lib/findings-filter";
import { readStorage, removeStorage, writeStorage } from "@/lib/local-storage";
import { useFindingsSelection } from "@/store/findings-selection";
import type { ColumnKey, FindingsPreset, FindingsTabKey } from "@/components/findings/findingsTableConfig";
import { presetColumns, rowHeightForPreset, sanitizeColumns } from "@/components/findings/findingsTableConfig";

function activeTab(filter: FindingsFilter): FindingsTabKey {
  return filter.kinds.length === 1 ? filter.kinds[0] : "all";
}

function presetStorageKey(tab: FindingsTabKey) {
  return `findings.preset.${tab}`;
}
function columnsStorageKey(tab: FindingsTabKey) {
  return `findings.columns.${tab}`;
}

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

  const tab = activeTab(filter);
  const [preset, setPreset] = useState<FindingsPreset>("triage");
  const [columnKeys, setColumnKeys] = useState<ColumnKey[]>(() => presetColumns(tab, "triage"));
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);

  useEffect(() => {
    removeStorage("findings.density");
  }, []);

  useEffect(() => {
    const savedPreset = readStorage<FindingsPreset>(presetStorageKey(tab), "triage");
    const safePreset: FindingsPreset = savedPreset === "custom" ? "custom" : savedPreset;
    setPreset(safePreset);

    if (safePreset === "custom") {
      const savedColumns = readStorage<ColumnKey[]>(columnsStorageKey(tab), presetColumns(tab, "triage"));
      setColumnKeys(sanitizeColumns(tab, savedColumns));
      return;
    }
    setColumnKeys(presetColumns(tab, safePreset));
  }, [tab]);

  const applyPreset = useCallback(
    (nextPreset: Exclude<FindingsPreset, "custom">) => {
      setPreset(nextPreset);
      writeStorage(presetStorageKey(tab), nextPreset);
      setColumnKeys(presetColumns(tab, nextPreset));
    },
    [tab],
  );

  const applyCustomColumns = useCallback(
    (columns: ColumnKey[]) => {
      const sanitized = sanitizeColumns(tab, columns);
      setColumnKeys(sanitized);
      setPreset("custom");
      writeStorage(presetStorageKey(tab), "custom");
      writeStorage(columnsStorageKey(tab), sanitized);
      setColumnChooserOpen(false);
    },
    [tab],
  );

  const rowHeight = rowHeightForPreset(preset);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  const previewIndex = useMemo(
    () => (previewId ? visibleIds.indexOf(previewId) : -1),
    [previewId, visibleIds],
  );

  const selectedIds = useFindingsSelection((s) => s.selected);
  const toggleSelect = useFindingsSelection((s) => s.toggle);
  const addManyToSelection = useFindingsSelection((s) => s.addMany);
  const clearSelection = useFindingsSelection((s) => s.clear);

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

  const closePreview = useCallback(() => {
    setPreviewId(null);
    previewTriggerRef.current?.focus();
  }, []);

  const openPreview = useCallback((id: string, triggerEl?: HTMLElement | null) => {
    previewTriggerRef.current = triggerEl ?? null;
    setPreviewId(id);
  }, []);

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

  const onNavigate = useCallback(
    (direction: -1 | 1) => {
      if (previewIndex < 0) return;
      const nextIndex = previewIndex + direction;
      if (nextIndex < 0 || nextIndex >= visibleIds.length) return;
      const nextId = visibleIds[nextIndex];
      if (!nextId) return;
      setPreviewId(nextId);
      window.history.replaceState(window.history.state, "", `/findings/${nextId}`);
    },
    [previewIndex, visibleIds],
  );

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
          preset={preset}
          onPresetChange={applyPreset}
          onOpenColumnChooser={() => setColumnChooserOpen(true)}
          isFetching={listMeta.fetching}
          onRefresh={handleRefresh}
          selectedCount={selectedIds.size}
          onBulkStatusClick={() => undefined}
        />

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <FlatFindingsTable
              filter={filter}
              rowHeight={rowHeight}
              columnKeys={columnKeys}
              onRowClick={openPreview}
              activeRowId={previewId}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectRange={addManyToSelection}
              onCountChange={handleCountChange}
              onVisibleIdsChange={setVisibleIds}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={() =>
                setSearchParams(filterToSearchParams(DEFAULT_FINDINGS_FILTER), {
                  replace: true,
                })
              }
            />
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
          currentIndex={previewIndex >= 0 ? previewIndex + 1 : null}
          totalCount={visibleIds.length}
          onPrev={() => onNavigate(-1)}
          onNext={() => onNavigate(1)}
          canPrev={previewIndex > 0}
          canNext={previewIndex >= 0 && previewIndex < visibleIds.length - 1}
        />
      )}
      <BulkActionsBar
        selected={selectedIds}
        onClear={clearSelection}
        projectId={filter.projectIds[0]}
      />

      <ColumnChooser
        tab={tab}
        open={columnChooserOpen}
        value={columnKeys}
        onApply={applyCustomColumns}
        onCancel={() => setColumnChooserOpen(false)}
        onResetPreset={() => {
          if (preset !== "custom") {
            setColumnKeys(presetColumns(tab, preset));
          } else {
            setColumnKeys(presetColumns(tab, "triage"));
          }
        }}
      />
    </div>
  );
}
