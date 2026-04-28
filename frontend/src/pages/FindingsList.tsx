import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { useHotkey } from "@/hooks/use-hotkey";

import FiltersPanel from "@/components/findings/FiltersPanel";
import KindTabs from "@/components/findings/KindTabs";
import SavedViewsBar from "@/components/findings/SavedViewsBar";
import FindingsToolbar from "@/components/findings/FindingsToolbar";
import FlatFindingsTable from "@/components/findings/FlatFindingsTable";
import GroupedFindingsTable from "@/components/findings/GroupedFindingsTable";
import PreviewPanel from "@/components/findings/PreviewPanel";
import ColumnChooser from "@/components/findings/ColumnChooser";
import BulkStatusCommentDialog, {
  type BulkStatusOption,
} from "@/components/findings/BulkStatusCommentDialog";
import { useBulkClose, useBulkUpdateStatus, useFindingsFacets } from "@/api/findings";
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
  const bulkUpdateStatus = useBulkUpdateStatus();
  const bulkClose = useBulkClose();
  const [nextStatus, setNextStatus] = useState<BulkStatusOption | null>(null);
  const [statusDialogError, setStatusDialogError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [highlightFilters, setHighlightFilters] = useState(false);

  type ExportToast = {
    type: "loading" | "success" | "error";
    message: string;
    action?: { label: string; onClick: () => void };
  } | null;
  const [exportToast, setExportToast] = useState<ExportToast>(null);

  useEffect(() => {
    if (highlightFilters) {
      const t = setTimeout(() => setHighlightFilters(false), 2000);
      return () => clearTimeout(t);
    }
  }, [highlightFilters]);

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
    filter.secretFingerprint.trim().length > 0 ||
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

  const pendingStatusChange = bulkUpdateStatus.isPending || bulkClose.isPending;

  const handleStatusSelect = useCallback((statusKey: BulkStatusOption) => {
    setStatusDialogError(null);
    setNextStatus(statusKey);
  }, []);

  const closeStatusDialog = useCallback(() => {
    if (pendingStatusChange) return;
    setStatusDialogError(null);
    setNextStatus(null);
  }, [pendingStatusChange]);

  const submitBulkStatus = useCallback(
    async (note: string) => {
      if (!nextStatus || selectedIds.size === 0) return;
      setStatusDialogError(null);

      const ids = Array.from(selectedIds);

      try {
        if (nextStatus === "open") {
          await bulkUpdateStatus.mutateAsync({ ids, status: 0, note });
        } else if (nextStatus === "confirmed") {
          await bulkUpdateStatus.mutateAsync({ ids, status: 1, note });
        } else if (nextStatus === "false_positive") {
          await bulkClose.mutateAsync({ ids, reasonCode: "false_positive", note });
        } else if (nextStatus === "fixed") {
          await bulkClose.mutateAsync({ ids, reasonCode: "mitigated", note });
        } else if (nextStatus === "accepted_risk") {
          await bulkClose.mutateAsync({ ids, reasonCode: "acceptable_risk", note });
        }

        clearSelection();
        setNextStatus(null);
      } catch (error) {
        setStatusDialogError(error instanceof Error ? error.message : "Не удалось сменить статус");
      }
    },
    [bulkClose, bulkUpdateStatus, clearSelection, nextStatus, selectedIds],
  );

  const exportFindings = useCallback(
    async (format: "csv" | "xlsx" | "json" | "html") => {
      setExportToast({ type: "loading", message: "Готовим выгрузку..." });
      setExportLoading(true);
      try {
        const params = filterToSearchParams(filter);
        const url = `/api/v1/findings/export.${format}?${params.toString()}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          let message = `Ошибка экспорта (${res.status})`;
          try {
            const body = (await res.json()) as { error?: { message?: string } };
            if (body.error?.message) message = body.error.message;
          } catch {
            // noop
          }
          if (res.status === 400) {
            setExportToast({
              type: "error",
              message,
              action: {
                label: "Уточнить фильтры",
                onClick: () => {
                  setHighlightFilters(true);
                  setExportToast(null);
                },
              },
            });
          } else {
            setExportToast({ type: "error", message });
          }
          return;
        }
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        const cd = res.headers.get("content-disposition");
        const fileName = cd?.match(/filename="([^"]+)"/)?.[1] ?? `findings.${format}`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        const count = Number(res.headers.get("x-export-total") ?? "0");
        setExportToast({
          type: "success",
          message: `Выгрузка готова: ${count.toLocaleString("ru-RU")} записей`,
        });
        setTimeout(() => setExportToast(null), 5000);
      } finally {
        setExportLoading(false);
      }
    },
    [filter],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
      <div
        className={cn(
          "flex min-h-0 transition-all duration-300",
          highlightFilters && "ring-2 ring-amber-400",
        )}
      >
        <FiltersPanel
          filter={filter}
          onChange={updateFilter}
          facets={facets}
          onSearchRef={(el) => {
            searchInputRef.current = el;
          }}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <KindTabs filter={filter} onChange={updateFilter} facets={facets} hasExplicitGroupBy={searchParams.has("group_by")} />

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
          onBulkStatusSelect={handleStatusSelect}
          onExport={exportFindings}
          exportDisabled={listMeta.total === 0}
          exportLoading={exportLoading}
        />

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {filter.groupBy === "" ? (
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
            ) : (
              <GroupedFindingsTable
                filter={filter}
                rowHeight={rowHeight}
                columnKeys={columnKeys}
                onRowClick={openPreview}
                onPickProject={(id) => updateFilter({ projectIds: [id] })}
                onCountChange={handleCountChange}
                onResetFilters={() =>
                  setSearchParams(filterToSearchParams(DEFAULT_FINDINGS_FILTER), {
                    replace: true,
                  })
                }
                hasActiveFilters={hasActiveFilters}
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
          currentIndex={previewIndex >= 0 ? previewIndex + 1 : null}
          totalCount={visibleIds.length}
          onPrev={() => onNavigate(-1)}
          onNext={() => onNavigate(1)}
          canPrev={previewIndex > 0}
          canNext={previewIndex >= 0 && previewIndex < visibleIds.length - 1}
        />
      )}
      <BulkStatusCommentDialog
        open={Boolean(nextStatus)}
        status={nextStatus}
        selectedCount={selectedIds.size}
        pending={pendingStatusChange}
        error={statusDialogError}
        onClose={closeStatusDialog}
        onSubmit={submitBulkStatus}
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

      {exportToast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3 rounded-xl border p-4 shadow-2xl",
            exportToast.type === "loading" &&
              "border-zinc-700 bg-zinc-900 text-zinc-300",
            exportToast.type === "success" &&
              "border-emerald-700 bg-emerald-950 text-emerald-200",
            exportToast.type === "error" &&
              "border-red-800 bg-red-950 text-red-200",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {exportToast.type === "loading" && (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            )}
            <span>{exportToast.message}</span>
            {exportToast.type !== "loading" && (
              <button
                onClick={() => setExportToast(null)}
                className="ml-auto shrink-0 text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
          {exportToast.action && (
            <button
              onClick={exportToast.action.onClick}
              className="self-start rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
            >
              {exportToast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
