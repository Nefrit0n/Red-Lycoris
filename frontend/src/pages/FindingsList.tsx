import {
  Alert,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bulkUpdateFindings, fetchFindings } from "../api/findings";
import { getCurrentUser } from "../api/auth";
import BulkActionsBar from "../components/BulkActionsBar";
import FiltersPanel from "../components/FiltersPanel";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import useDebouncedValue from "../hooks/useDebouncedValue";
import {
  Finding,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

// 👇 важно: нужен экспорт FindingDetailContent из FindingDetail.tsx
import { FindingDetailContent } from "./FindingDetail";

const severityOptions: FindingSeverity[] = ["low", "medium", "high", "critical"];

const statusOptions: FindingStatus[] = [
  "new",
  "under_review",
  "confirmed",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "mitigated",
  "duplicate",
];

const occurrenceOptions: FindingOccurrenceStatus[] = ["NEW", "REPEAT"];

type BulkUndoItem = {
  id: string;
  status: FindingStatus;
};

const FindingsList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const listStateKey = "lotus_warden_findings_list_state";

  const isMdUp = useMediaQuery("(min-width:900px)");

  // ✅ ВАЖНО: не даём эффекту "state -> URL" работать, пока не распарсили URL -> state
  const [hydrated, setHydrated] = useState(false);

  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [productId, setProductId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [importJobId, setImportJobId] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<FindingSeverity | "">("");
  const [filterStatus, setFilterStatus] = useState<FindingStatus | "">("");
  const [filterOccurrence, setFilterOccurrence] = useState<FindingOccurrenceStatus | "">("");
  const [filterScannerType, setFilterScannerType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRepeats, setShowRepeats] = useState(false);

  const [sortField, setSortField] = useState<keyof Finding>("lastSeenAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkUndoItems, setBulkUndoItems] = useState<BulkUndoItem[]>([]);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [undoToastOpen, setUndoToastOpen] = useState(false);

  // ✅ Drawer: выбранная находка
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // base returnTo без selected (чтобы если открыть в новой вкладке — назад не открывал Drawer снова)
  const listReturnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete("selected");
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  }, [location.pathname, location.search]);

  const openDrawer = useCallback((id: string) => {
    const listPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem(
      listStateKey,
      JSON.stringify({ path: listPath, scrollY: window.scrollY })
    );
    setSelectedFindingId(id);
  }, [location.pathname, location.search, listStateKey]);

  const closeDrawer = useCallback(() => {
    setSelectedFindingId(null);
  }, []);

  // 1) URL -> state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryProduct = params.get("product");
    const queryProductId = params.get("productId");
    const queryImportJobId = params.get("import_job_id");
    const querySeverity = params.get("severity");
    const queryStatus = params.get("status");
    const querySearch = params.get("search") ?? params.get("q") ?? "";
    const queryPage = Number(params.get("page") ?? "1");
    const queryLimit = Number(params.get("limit") ?? "20");
    const querySortField = params.get("sortField");
    const querySortOrder = params.get("sortOrder");
    const queryOccurrence = params.get("occurrenceStatus");
    const queryScanner = params.get("scannerType") ?? "";
    const queryDateFrom = params.get("dateFrom") ?? "";
    const queryDateTo = params.get("dateTo") ?? "";
    const queryIncludeRepeats = params.get("includeRepeats");
    const queryCanonicalOnly = params.get("canonicalOnly");

    // ✅ Drawer param
    const querySelected = params.get("selected");

    const nextPage =
      Number.isFinite(queryPage) && queryPage > 0 ? queryPage - 1 : 0;
    const nextPageSize =
      Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 20;

    setPage((prev) => (prev !== nextPage ? nextPage : prev));
    setPageSize((prev) => (prev !== nextPageSize ? nextPageSize : prev));

    const nextProduct = queryProduct || queryProductId || "";
    setProductId((prev) => (prev !== nextProduct ? nextProduct : prev));

    const nextSeverity = severityOptions.includes(querySeverity as FindingSeverity)
      ? (querySeverity as FindingSeverity)
      : "";
    setFilterSeverity((prev) => (prev !== nextSeverity ? nextSeverity : prev));

    const nextStatus = statusOptions.includes(queryStatus as FindingStatus)
      ? (queryStatus as FindingStatus)
      : "";
    setFilterStatus((prev) => (prev !== nextStatus ? nextStatus : prev));

    const nextOccurrence = occurrenceOptions.includes(queryOccurrence as FindingOccurrenceStatus)
      ? (queryOccurrence as FindingOccurrenceStatus)
      : "";
    setFilterOccurrence((prev) => (prev !== nextOccurrence ? nextOccurrence : prev));

    setFilterScannerType((prev) => (prev !== queryScanner ? queryScanner : prev));
    setDateFrom((prev) => (prev !== queryDateFrom ? queryDateFrom : prev));
    setDateTo((prev) => (prev !== queryDateTo ? queryDateTo : prev));

    const nextShowRepeats =
      queryIncludeRepeats === "true" ||
      queryCanonicalOnly === "false";
    setShowRepeats((prev) => (prev !== nextShowRepeats ? nextShowRepeats : prev));

    setSearchInput((prev) => (prev !== querySearch ? querySearch : prev));

    setImportJobId((prev) =>
      prev !== (queryImportJobId || "") ? queryImportJobId || "" : prev
    );

    const nextSortField = (querySortField as keyof Finding) || "lastSeenAt";
    const allowedSortFields: Array<keyof Finding> = [
      "title",
      "productName",
      "severity",
      "status",
      "lastSeenAt",
      "createdAt",
      "updatedAt",
    ];
    const safeSortField = allowedSortFields.includes(nextSortField)
      ? nextSortField
      : "lastSeenAt";
    setSortField((prev) => (prev !== safeSortField ? safeSortField : prev));

    const safeSortOrder = querySortOrder === "asc" ? "asc" : "desc";
    setSortOrder((prev) => (prev !== safeSortOrder ? safeSortOrder : prev));

    // ✅ selected (Drawer)
    setSelectedFindingId((prev) => (prev !== querySelected ? querySelected : prev));

    setHydrated(true);
  }, [location.search]);

  // 2) state -> URL (только после hydrated)
  useEffect(() => {
    if (!hydrated) return;

    const params = new URLSearchParams();
    params.set("page", (page + 1).toString());
    params.set("limit", pageSize.toString());
    if (productId) params.set("product", productId);
    if (filterSeverity) params.set("severity", filterSeverity);
    if (filterStatus) params.set("status", filterStatus);
    if (filterOccurrence) params.set("occurrenceStatus", filterOccurrence);
    if (filterScannerType) params.set("scannerType", filterScannerType);
    if (searchInput) params.set("search", searchInput);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (importJobId) params.set("import_job_id", importJobId);
    params.set("canonicalOnly", showRepeats ? "false" : "true");
    params.set("includeRepeats", showRepeats ? "true" : "false");
    if (sortField) params.set("sortField", String(sortField));
    if (sortOrder) params.set("sortOrder", sortOrder);

    // ✅ Drawer param
    if (selectedFindingId) params.set("selected", selectedFindingId);

    const nextSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, "");

    if (nextSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
        { replace: true }
      );
    }
  }, [
    hydrated,
    page,
    pageSize,
    productId,
    filterSeverity,
    filterStatus,
    filterOccurrence,
    filterScannerType,
    searchInput,
    dateFrom,
    dateTo,
    showRepeats,
    importJobId,
    sortField,
    sortOrder,
    selectedFindingId,
    location.pathname,
    location.search,
    navigate,
  ]);

  // авто-переход на product после upload
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryProduct = params.get("product") || params.get("productId");
    const queryImportJobId = params.get("import_job_id");
    if (queryProduct || queryImportJobId) return;

    const raw = localStorage.getItem("lotus_warden_last_upload");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { productId?: string | null };
      if (parsed.productId) {
        params.set("product", parsed.productId);
        params.set("page", "1");
        params.set("limit", pageSize.toString());
        navigate(
          { pathname: location.pathname, search: `?${params.toString()}` },
          { replace: true }
        );
      }
    } finally {
      localStorage.removeItem("lotus_warden_last_upload");
    }
  }, [location.pathname, location.search, navigate, pageSize]);

  // scroll restore
  useEffect(() => {
    const raw = sessionStorage.getItem(listStateKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { path?: string; scrollY?: number };
      if (
        parsed.path === `${location.pathname}${location.search}` &&
        typeof parsed.scrollY === "number"
      ) {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: parsed.scrollY ?? 0, behavior: "auto" });
        });
      }
    } catch {
      sessionStorage.removeItem(listStateKey);
    }
  }, [listStateKey, location.pathname, location.search]);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const normalizedDateFrom = dateFrom
          ? new Date(`${dateFrom}T00:00:00Z`).toISOString()
          : undefined;
        const normalizedDateTo = dateTo
          ? new Date(`${dateTo}T23:59:59Z`).toISOString()
          : undefined;

        const response = await fetchFindings(
          {
            limit: pageSize,
            offset: page * pageSize,
            filterProduct: productId,
            filterSeverity,
            filterStatus,
            filterOccurrence,
            filterScannerType,
            search: debouncedSearch,
            dateFrom: normalizedDateFrom,
            dateTo: normalizedDateTo,
            canonicalOnly: !showRepeats,
            includeRepeats: showRepeats,
            importJobId,
            sortField,
            sortOrder,
          },
          signal
        );

        if (!response || !Array.isArray(response.data)) {
          setData([]);
          setTotal(0);
        } else {
          setData(response.data);
          setTotal(typeof response.total === "number" ? response.total : 0);
        }

        if (!selectAllMatching) setSelectedIds([]);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить данные. Попробуйте позже.");
          setData([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      pageSize,
      productId,
      debouncedSearch,
      importJobId,
      filterSeverity,
      filterStatus,
      filterOccurrence,
      filterScannerType,
      dateFrom,
      dateTo,
      showRepeats,
      sortField,
      sortOrder,
      selectAllMatching,
    ]
  );

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, hydrated]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  }, [
    productId,
    filterSeverity,
    filterStatus,
    filterOccurrence,
    filterScannerType,
    dateFrom,
    dateTo,
    showRepeats,
    searchInput,
    importJobId,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    if (selectAllMatching) setSelectedIds(data.map((item) => item.id));
  }, [data, selectAllMatching]);

  // если включили batch mode — лучше закрыть Drawer, чтобы не мешал
  const selectionCount = selectAllMatching ? total : selectedIds.length;
  useEffect(() => {
    if (selectionCount > 0 && selectedFindingId) setSelectedFindingId(null);
  }, [selectionCount, selectedFindingId]);

  const handleResetFilters = () => {
    setProductId("");
    setSearchInput("");
    setImportJobId("");
    setFilterSeverity("");
    setFilterStatus("");
    setFilterOccurrence("");
    setFilterScannerType("");
    setDateFrom("");
    setDateTo("");
    setShowRepeats(false);
    setPage(0);
    setSortField("lastSeenAt");
    setSortOrder("desc");
    setSelectedIds([]);
    setSelectAllMatching(false);
    setSelectedFindingId(null);
  };

  const handleSortChange = (field: keyof Finding) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const handleToggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      setSelectAllMatching(false);
      return;
    }
    setSelectAllMatching(false);
    setSelectedIds(data.map((item) => item.id));
  };

  const handleToggleOne = (id: string) => {
    if (selectAllMatching) setSelectAllMatching(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const user = getCurrentUser();
  const canBulk = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const showSelectAllPrompt =
    !selectAllMatching &&
    selectedIds.length > 0 &&
    selectedIds.length === data.length &&
    total > data.length;

  const handleClearSelection = () => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  };

  const handleSelectAllResults = () => setSelectAllMatching(true);

  const handleRetry = () => fetchData();

  const handleBulkApply = async (
    action: "set_status" | "assign" | "dismiss",
    payload: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await bulkUpdateFindings({
        ids: selectAllMatching ? [] : selectedIds,
        select_all: selectAllMatching,
        filters: selectAllMatching
          ? {
            product: productId || undefined,
            severity: filterSeverity || undefined,
            status: filterStatus || undefined,
            occurrenceStatus: filterOccurrence || undefined,
            scannerType: filterScannerType || undefined,
            q: debouncedSearch || undefined,
            import_job_id: importJobId || undefined,
            dateFrom: dateFrom
              ? new Date(`${dateFrom}T00:00:00Z`).toISOString()
              : undefined,
            dateTo: dateTo
              ? new Date(`${dateTo}T23:59:59Z`).toISOString()
              : undefined,
            canonicalOnly: !showRepeats,
            includeRepeats: showRepeats,
          }
          : undefined,
        action,
        payload,
      });

      const undoItems =
        response?.prevStatuses?.filter(
          (item): item is BulkUndoItem => Boolean(item?.id) && Boolean(item?.status)
        ) ?? [];

      setBulkUndoItems(undoItems);
      setBulkToast(`Обновлено находок: ${response?.affectedCount ?? 0}`);
      setUndoToastOpen(true);
      setSelectedIds([]);
      setSelectAllMatching(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить массовую операцию");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (bulkUndoItems.length === 0) {
      setUndoToastOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const grouped = bulkUndoItems.reduce<Record<FindingStatus, string[]>>((acc, item) => {
        const status = item.status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(item.id);
        return acc;
      }, {} as Record<FindingStatus, string[]>);

      for (const [status, ids] of Object.entries(grouped)) {
        await bulkUpdateFindings({
          ids,
          action: "set_status",
          payload: { status },
        });
      }

      setBulkToast("Изменения отменены");
      setUndoToastOpen(true);
      setBulkUndoItems([]);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить изменения");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Перехват клика по ссылкам /findings/:id, чтобы открыть Drawer вместо перехода
  const handleTableLinkClickCapture = (e: React.MouseEvent) => {
    // уважим открытия в новой вкладке/окне
    if ((e as any).metaKey || (e as any).ctrlKey || (e as any).shiftKey || (e as any).button === 1) return;

    const target = e.target as HTMLElement | null;
    const a = target?.closest("a") as HTMLAnchorElement | null;
    if (!a?.href) return;

    let url: URL;
    try {
      url = new URL(a.href);
    } catch {
      return;
    }

    // только ссылки на finding detail
    if (!url.pathname.startsWith("/findings/")) return;

    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[1];
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();
    openDrawer(id);
  };

  const drawerWidth = isMdUp ? 620 : "100vw";

  const openInNewTab = () => {
    if (!selectedFindingId) return;
    const url = `/findings/${selectedFindingId}?returnTo=${encodeURIComponent(listReturnTo)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Список находок
      </Typography>

      <FiltersPanel
        productId={productId}
        search={searchInput}
        filterSeverity={filterSeverity}
        filterStatus={filterStatus}
        filterOccurrence={filterOccurrence}
        filterScannerType={filterScannerType}
        dateFrom={dateFrom}
        dateTo={dateTo}
        showRepeats={showRepeats}
        onProductIdChange={(v) => {
          setProductId(v);
          setPage(0);
        }}
        onSearchChange={(v) => {
          setSearchInput(v);
          setPage(0);
        }}
        onSeverityChange={(v) => {
          setFilterSeverity(v);
          setPage(0);
        }}
        onStatusChange={(v) => {
          setFilterStatus(v);
          setPage(0);
        }}
        onOccurrenceChange={(v) => {
          setFilterOccurrence(v);
          setPage(0);
        }}
        onScannerTypeChange={(v) => {
          setFilterScannerType(v);
          setPage(0);
        }}
        onDateFromChange={(v) => {
          setDateFrom(v);
          setPage(0);
        }}
        onDateToChange={(v) => {
          setDateTo(v);
          setPage(0);
        }}
        onShowRepeatsChange={(value) => {
          setShowRepeats(value);
          setPage(0);
        }}
        onReset={handleResetFilters}
      />

      {canBulk && selectionCount > 0 && (
        <BulkActionsBar
          selectedCount={selectionCount}
          onApply={handleBulkApply}
          onClearSelection={handleClearSelection}
        />
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box onClickCapture={handleTableLinkClickCapture}>
          <FindingsTable
            data={data}
            selectedIds={selectedIds}
            sortField={sortField}
            sortOrder={sortOrder}
            onToggleAll={handleToggleAll}
            onToggleOne={handleToggleOne}
            onSortChange={handleSortChange}
            loading={loading}
            errorMessage={error}
            onRetry={handleRetry}
            onResetFilters={handleResetFilters}
            batchMode={selectionCount > 0}
            highlightQuery={debouncedSearch}
            rowCount={pageSize}
            onOpenDetail={(id) => openDrawer(id)}
            activeId={selectedFindingId}
            returnTo={`${location.pathname}${location.search}`}
            onNavigateToDetail={() => {
              // оставляем как было (на всякий), но теперь в основном открываем Drawer
              const listPath = `${location.pathname}${location.search}`;
              sessionStorage.setItem(
                listStateKey,
                JSON.stringify({ path: listPath, scrollY: window.scrollY })
              );
            }}
          />
        </Box>

        {showSelectAllPrompt && (
          <Box px={3} pb={3}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={handleSelectAllResults}>
                  Выбрать все {total} результатов
                </Button>
              }
            >
              Выбрано {selectedIds.length} на странице.
            </Alert>
          </Box>
        )}

        {selectAllMatching && (
          <Box px={3} pb={3}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={handleClearSelection}>
                  Снять выбор
                </Button>
              }
            >
              Выбраны все {total} результатов по фильтрам.
            </Alert>
          </Box>
        )}
      </Paper>

      <PaginationControl
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          if (!selectAllMatching) setSelectedIds([]);
        }}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(0);
          if (!selectAllMatching) setSelectedIds([]);
        }}
      />

      <Snackbar
        open={undoToastOpen}
        autoHideDuration={8000}
        onClose={() => setUndoToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          onClose={() => setUndoToastOpen(false)}
          action={
            bulkUndoItems.length > 0 ? (
              <Button color="inherit" size="small" onClick={handleUndo}>
                Undo
              </Button>
            ) : null
          }
        >
          {bulkToast ?? ""}
        </Alert>
      </Snackbar>

      {/* ✅ Right Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedFindingId)}
        onClose={closeDrawer}
        PaperProps={{
          sx: {
            width: drawerWidth,
            maxWidth: "100vw",
            borderTopLeftRadius: isMdUp ? 16 : 0,
            borderBottomLeftRadius: isMdUp ? 16 : 0,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Детали находки
            </Typography>

            <Stack direction="row" gap={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={openInNewTab}
                disabled={!selectedFindingId}
              >
                Открыть
              </Button>
              <IconButton onClick={closeDrawer} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>

          {selectedFindingId && (
            <Typography variant="caption" color="text.secondary">
              ID: {selectedFindingId}
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
          {selectedFindingId ? (
            <FindingDetailContent id={selectedFindingId} compact onClose={closeDrawer} />
          ) : null}
        </Box>
      </Drawer>
    </Container>
  );
};

export default FindingsList;
