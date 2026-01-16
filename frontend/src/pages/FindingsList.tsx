import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { bulkUpdateFindings, fetchFindings } from "../api/findings";
import { getCurrentUser } from "../api/auth";
import BulkActionsBar from "../components/BulkActionsBar";
import FiltersPanel from "../components/FiltersPanel";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import {
  Finding,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

const FindingsList = () => {
  const location = useLocation();
  // ⚠️ Никогда не undefined
  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [importJobId, setImportJobId] = useState("");
  const [filterSeverity, setFilterSeverity] =
    useState<FindingSeverity | "">("");
  const [filterStatus, setFilterStatus] =
    useState<FindingStatus | "">("");

  const [sortField, setSortField] =
    useState<keyof Finding>("createdAt");
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryProductId = params.get("productId");
    const importJobId = params.get("import_job_id");
    if (importJobId) {
      setSearch("");
      setProductId("");
      setImportJobId(importJobId);
      setPage(0);
      return;
    }
    setImportJobId("");
    if (queryProductId) {
      setProductId(queryProductId);
      setPage(0);
      return;
    }

    const raw = localStorage.getItem("lotus_warden_last_upload");
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { productId?: string | null };
      if (parsed.productId) {
        setProductId(parsed.productId);
        setPage(0);
      }
    } finally {
      localStorage.removeItem("lotus_warden_last_upload");
    }
  }, [location.search]);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchFindings(
          {
            limit: pageSize,
            offset: page * pageSize,
            filterProductId: productId,
            filterSeverity,
            filterStatus,
            search,
            importJobId,
            sortField,
            sortOrder,
          },
          signal
        );

        // 🛡️ НОРМАЛИЗАЦИЯ
        if (!response || !Array.isArray(response.data)) {
          setData([]);
          setTotal(0);
        } else {
          setData(response.data);
          setTotal(
            typeof response.total === "number" ? response.total : 0
          );
        }

        setSelectedIds([]);
      } catch (err) {
        if (
          !(err instanceof DOMException && err.name === "AbortError")
        ) {
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
      search,
      importJobId,
      filterSeverity,
      filterStatus,
      sortField,
      sortOrder,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleResetFilters = () => {
    setProductId("");
    setSearch("");
    setImportJobId("");
    setFilterSeverity("");
    setFilterStatus("");
    setPage(0);
  };

  const handleSortChange = (field: keyof Finding) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedIds(
      checked ? data.map((item) => item.id) : []
    );
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const user = getCurrentUser();
  const canBulk =
    user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const handleBulkApply = async (
    action: "set_status" | "assign" | "dismiss",
    payload: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);
    try {
      await bulkUpdateFindings({
        ids: selectedIds,
        action,
        payload,
      });
      await fetchData();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Не удалось выполнить массовую операцию");
      }
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
        search={search}
        filterSeverity={filterSeverity}
        filterStatus={filterStatus}
        onProductIdChange={(v) => {
          setProductId(v);
          setPage(0);
        }}
        onSearchChange={(v) => {
          setSearch(v);
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

      {canBulk && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onApply={handleBulkApply}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : (
          <FindingsTable
            data={data}
            selectedIds={selectedIds}
            sortField={sortField}
            sortOrder={sortOrder}
            onToggleAll={handleToggleAll}
            onToggleOne={handleToggleOne}
            onSortChange={handleSortChange}
          />
        )}
      </Paper>

      <PaginationControl
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(0);
        }}
      />
    </Container>
  );
};

export default FindingsList;
