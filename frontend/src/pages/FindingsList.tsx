import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bulkUpdateFindings, fetchFindings } from "../api/findings";
import { getCurrentUser } from "../api/auth";
import BulkActionsBar from "../components/BulkActionsBar";
import FiltersPanel from "../components/FiltersPanel";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { Finding, FindingSeverity, FindingStatus } from "../types/findings";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT_FIELD: keyof Finding = "createdAt";
const DEFAULT_SORT_ORDER: "asc" | "desc" = "desc";

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

type BulkUndoItem = {
  id: string;
  status: FindingStatus;
};

const allowedSortFields: Array<keyof Finding> = [
  "title",
  "productName",
  "severity",
  "status",
  "createdAt",
  "updatedAt",
];

type ParsedQuery = {
  page: number;
  pageSize: number;
  productId: string;
  importJobId: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  searchInput: string;
  sortField: keyof Finding;
  sortOrder: "asc" | "desc";
  // чтобы не “переписывать” productId -> product и не ловить лишний navigate
  productParamKey: "product" | "productId";
};

function parseQuery(search: string): ParsedQuery {
  const params = new URLSearchParams(search);

  const queryProduct = params.get("product");
  const queryProductId = params.get("productId");

  const productParamKey: "product" | "productId" =
    !queryProduct && queryProductId ? "productId" : "product";

  const queryPage = Number(params.get("page") ?? "1");
  const queryLimit = Number(params.get("limit") ?? String(DEFAULT_PAGE_SIZE));

  const page = Number.isFinite(queryPage) && queryPage > 0 ? queryPage - 1 : 0;
  const pageSize =
    Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : DEFAULT_PAGE_SIZE;

  const querySeverity = params.get("severity");
  const filterSeverity = severityOptions.includes(querySeverity as FindingSeverity)
    ? (querySeverity as FindingSeverity)
    : "";

  const queryStatus = params.get("status");
  const filterStatus = statusOptions.includes(queryStatus as FindingStatus)
    ? (queryStatus as FindingStatus)
    : "";

  const searchInput = params.get("q") ?? "";
  const importJobId = params.get("import_job_id") ?? "";

  const querySortField = params.get("sortField") as keyof Finding | null;
  const safeSortField = querySortField && allowedSortFields.includes(querySortField)
    ? querySortField
    : DEFAULT_SORT_FIELD;

  const querySortOrder = params.get("sortOrder");
  const sortOrder: "asc" | "desc" = querySortOrder === "asc" ? "asc" : DEFAULT_SORT_ORDER;

  return {
    page,
    pageSize,
    productId: queryProduct || queryProductId || "",
    importJobId,
    filterSeverity,
    filterStatus,
    searchInput,
    sortField: safeSortField,
    sortOrder,
    productParamKey,
  };
}

const FindingsList = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const listStateKey = "lotus_warden_findings_list_state";

  // ВАЖНО: инициализируемся сразу из URL, чтобы НЕ было первого запроса “без product”
  const initial = useMemo(() => parseQuery(location.search), []); // только на маунте

  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  const [productId, setProductId] = useState(initial.productId);
  const [searchInput, setSearchInput] = useState(initial.searchInput);
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const [importJobId, setImportJobId] = useState(initial.importJobId);
  const [filterSeverity, setFilterSeverity] = useState<FindingSeverity | "">(initial.filterSeverity);
  const [filterStatus, setFilterStatus] = useState<FindingStatus | "">(initial.filterStatus);

  const [sortField, setSortField] = useState<keyof Finding>(initial.sortField);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initial.sortOrder);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkUndoItems, setBulkUndoItems] = useState<BulkUndoItem[]>([]);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [undoToastOpen, setUndoToastOpen] = useState(false);

  // чтобы не “переписывать” productId <-> product при переходах
  const productParamKeyRef = useRef<"product" | "productId">(initial.productParamKey);

  // 1) URL -> state (для back/forward и переходов с других страниц)
  useEffect(() => {
    const parsed = parseQuery(location.search);

    productParamKeyRef.current = parsed.productParamKey;

    setPage((prev) => (prev !== parsed.page ? parsed.page : prev));
    setPageSize((prev) => (prev !== parsed.pageSize ? parsed.pageSize : prev));

    setProductId((prev) => (prev !== parsed.productId ? parsed.productId : prev));
    setFilterSeverity((prev) => (prev !== parsed.filterSeverity ? parsed.filterSeverity : prev));
    setFilterStatus((prev) => (prev !== parsed.filterStatus ? parsed.filterStatus : prev));

    setSearchInput((prev) => (prev !== parsed.searchInput ? parsed.searchInput : prev));
    setImportJobId((prev) => (prev !== parsed.importJobId ? parsed.importJobId : prev));

    setSortField((prev) => (prev !== parsed.sortField ? parsed.sortField : prev));
    setSortOrder((prev) => (prev !== parsed.sortOrder ? parsed.sortOrder : prev));
  }, [location.search]);

  // 2) state -> URL (НО: не пишем дефолты в URL, чтобы не было лишних переходов/запросов)
  useEffect(() => {
    const params = new URLSearchParams();

    // не добавляем дефолты в URL
    if (page !== 0) params.set("page", (page + 1).toString());
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("limit", pageSize.toString());

    if (productId) {
      params.set(productParamKeyRef.current, productId);
    }
    if (filterSeverity) params.set("severity", filterSeverity);
    if (filterStatus) params.set("status", filterStatus);
    if (searchInput) params.set("q", searchInput);
    if (importJobId) params.set("import_job_id", importJobId);

    if (sortField !== DEFAULT_SORT_FIELD) params.set("sortField", String(sortField));
    if (sortOrder !== DEFAULT_SORT_ORDER) params.set("sortOrder", sortOrder);

    const nextSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, "");

    if (nextSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
        { replace: true } // важно: не засоряем history и уменьшаем “дёрганье”
      );
    }
  }, [
    page,
    pageSize,
    productId,
    filterSeverity,
    filterStatus,
    searchInput,
    importJobId,
    sortField,
    sortOrder,
    location.pathname,
    location.search,
    navigate,
  ]);

  // Авто-фокус после upload (оставляем как было)
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
        // мы просто задаём стейт — URL эффект сам подстроится
        productParamKeyRef.current = "product";
        setProductId(parsed.productId);
        setPage(0);
      }
    } finally {
      localStorage.removeItem("lotus_warden_last_upload");
    }
  }, [location.search]);

  // Восстановление скролла
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
        const response = await fetchFindings(
          {
            limit: pageSize,
            offset: page * pageSize,
            filterProduct: productId, // как у тебя было
            filterSeverity,
            filterStatus,
            search: debouncedSearch,
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

        if (!selectAllMatching) {
          setSelectedIds([]);
        }
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
      sortField,
      sortOrder,
      selectAllMatching,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  }, [productId, filterSeverity, filterStatus, searchInput, importJobId, sortField, sortOrder]);

  useEffect(() => {
    if (selectAllMatching) {
      setSelectedIds(data.map((item) => item.id));
    }
  }, [data, selectAllMatching]);

  const handleResetFilters = () => {
    productParamKeyRef.current = "product";
    setProductId("");
    setSearchInput("");
    setImportJobId("");
    setFilterSeverity("");
    setFilterStatus("");
    setPage(0);
    setSortField(DEFAULT_SORT_FIELD);
    setSortOrder(DEFAULT_SORT_ORDER);
    setSelectedIds([]);
    setSelectAllMatching(false);
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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const user = getCurrentUser();
  const canBulk = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const selectionCount = selectAllMatching ? total : selectedIds.length;
  const showSelectAllPrompt =
    !selectAllMatching && selectedIds.length > 0 && selectedIds.length === data.length && total > data.length;

  const handleClearSelection = () => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  };

  const handleSelectAllResults = () => setSelectAllMatching(true);
  const handleRetry = () => fetchData();

  const handleNavigateToDetail = () => {
    const listPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem(listStateKey, JSON.stringify({ path: listPath, scrollY: window.scrollY }));
  };

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
            q: debouncedSearch || undefined,
            import_job_id: importJobId || undefined,
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
        if (!acc[item.status]) acc[item.status] = [];
        acc[item.status].push(item.id);
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

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Список находок
      </Typography>

      <FiltersPanel
        productId={productId}
        search={searchInput}
        filterSeverity={filterSeverity}
        filterStatus={filterStatus}
        onProductIdChange={(v) => {
          // если пользователь меняет фильтр руками — считаем ключ каноничным
          productParamKeyRef.current = "product";
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
        onReset={handleResetFilters}
      />

      {canBulk && selectionCount > 0 && (
        <BulkActionsBar
          selectedCount={selectionCount}
          onApply={handleBulkApply}
          onClearSelection={handleClearSelection}
        />
      )}

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
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
          returnTo={`${location.pathname}${location.search}`}
          onNavigateToDetail={handleNavigateToDetail}
        />

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
    </Container>
  );
};

export default FindingsList;
