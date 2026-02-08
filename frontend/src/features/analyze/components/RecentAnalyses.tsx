import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnalysisJob } from "../../../api/analysisJobs";

type RecentAnalysesProps = {
  jobs: AnalysisJob[];
  loading: boolean;
  error?: string | null;
};

const statusLabel = (status: string) => {
  switch (status) {
    case "queued":
      return "В очереди";
    case "processing":
      return "В работе";
    case "succeeded":
      return "Успешно";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
};

const RecentAnalyses = ({ jobs, loading, error }: RecentAnalysesProps) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [scannerFilter, setScannerFilter] = useState("all");

  const statusOptions = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.status))),
    [jobs]
  );

  const productOptions = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) => job.productName)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [jobs]
  );

  const scannerOptions = useMemo(
    () => Array.from(new Set(jobs.flatMap((job) => job.scanners))),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) {
        return false;
      }
      if (productFilter !== "all" && job.productName !== productFilter) {
        return false;
      }
      if (scannerFilter !== "all" && !job.scanners.includes(scannerFilter)) {
        return false;
      }
      return true;
    });
  }, [jobs, productFilter, scannerFilter, statusFilter]);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="subtitle1">Последние анализы</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Select
            size="small"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <MenuItem value="all">Все статусы</MenuItem>
            {statusOptions.map((status) => (
              <MenuItem key={status} value={status}>
                {statusLabel(status)}
              </MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <MenuItem value="all">Все продукты</MenuItem>
            {productOptions.map((product) => (
              <MenuItem key={product} value={product}>
                {product}
              </MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            value={scannerFilter}
            onChange={(event) => setScannerFilter(event.target.value)}
          >
            <MenuItem value="all">Все сканеры</MenuItem>
            {scannerOptions.map((scanner) => (
              <MenuItem key={scanner} value={scanner}>
                {scanner}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress size={26} />
          </Box>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box component="thead" sx={{ backgroundColor: "action.hover" }}>
              <Box component="tr">
                {["ID анализа", "Продукт", "Сканеры", "Статус", "Создан"].map((label) => (
                  <Box
                    component="th"
                    key={label}
                    sx={{ textAlign: "left", px: 2, py: 1.5, fontWeight: 600, fontSize: 13 }}
                  >
                    {label}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {filteredJobs.length === 0 ? (
                <Box component="tr">
                  <Box component="td" colSpan={5} sx={{ py: 5, textAlign: "center" }}>
                    <Typography color="text.secondary">Нет анализов по выбранным фильтрам.</Typography>
                  </Box>
                </Box>
              ) : (
                filteredJobs.map((item) => (
                  <Box
                    component="tr"
                    key={item.id}
                    sx={{ borderTop: "1px solid", borderColor: "divider" }}
                  >
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      <Button component={Link} to={`/analyze/${item.id}`} size="small">
                        {item.id}
                      </Button>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      {item.productName || "—"}
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      {item.scanners.join(", ")}
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      {statusLabel(item.status)}
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 1.5 }}>
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
    </Stack>
  );
};

export default RecentAnalyses;
