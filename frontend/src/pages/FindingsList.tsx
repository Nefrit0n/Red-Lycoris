import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { fetchFindings } from "../api/findings";
import FiltersPanel from "../components/FiltersPanel";
import FindingsTable from "../components/FindingsTable";
import PaginationControl from "../components/PaginationControl";
import {
  Finding,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

const appOptions = ["WebApp", "Mobile", "Internal API", "Gateway"];

const FindingsList = () => {
  const [data, setData] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [filterApp, setFilterApp] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<FindingSeverity | "">("");
  const [filterStatus, setFilterStatus] = useState<FindingStatus | "">("");

  const [sortField, setSortField] = useState<keyof Finding | "">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "">("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFindings(
        {
          page: page + 1,
          pageSize,
          filterApp,
          filterSeverity,
          filterStatus,
          sortField,
          sortOrder,
        },
        signal
      );
      setData(response.data);
      setTotal(response.total);
      setSelectedIds([]);
    } catch (fetchError) {
      if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
        setError("Не удалось загрузить данные. Попробуйте позже.");
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    filterApp,
    filterSeverity,
    filterStatus,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleResetFilters = () => {
    setFilterApp("");
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
    if (checked) {
      setSelectedIds(data.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const tableContent = loading ? (
    <Box display="flex" justifyContent="center" py={8}>
      <CircularProgress aria-label="Загрузка" />
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
  );

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Список находок
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Управляйте результатами сканирования уязвимостей, сортируйте и фильтруйте
        данные по приложению, критичности и статусу.
      </Typography>

      <FiltersPanel
        appOptions={appOptions}
        filterApp={filterApp}
        filterSeverity={filterSeverity}
        filterStatus={filterStatus}
        onAppChange={(value) => {
          setFilterApp(value);
          setPage(0);
        }}
        onSeverityChange={(value) => {
          setFilterSeverity(value);
          setPage(0);
        }}
        onStatusChange={(value) => {
          setFilterStatus(value);
          setPage(0);
        }}
        onReset={handleResetFilters}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} aria-label="Ошибка загрузки">
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        {tableContent}
      </Paper>

      <PaginationControl
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(0);
        }}
      />
    </Container>
  );
};

export default FindingsList;
