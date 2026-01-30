import {
  Alert,
  Box,
  Container,
  IconButton,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Link as MuiLink,
  TextField,
  MenuItem,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { alpha as muiAlpha } from "@mui/material/styles";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { fetchImportJobs } from "../api/importJobs";
import PaginationControl from "../components/PaginationControl";
import { ImportJobListItemDTO } from "../types/imports";
import DataTable, { TableChip, TableEmptyState, TableLoadingRows } from "../components/DataTable";
import { semantic } from "../design-system/tokens/colors";

const ImportJobsList = () => {
  const [data, setData] = useState<ImportJobListItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [productId, setProductId] = useState("");
  const [scanner, setScanner] = useState("");
  const [status, setStatus] = useState("");

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchImportJobs(
          {
            limit: pageSize,
            offset: page * pageSize,
            productId,
            scanner,
            status,
          },
          signal
        );
        setData(response.data);
        setTotal(response.total);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить список импортов.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, productId, scanner, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Import Jobs
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        История загрузок и статус обработки сканов.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", p: 2, mb: 3 }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Product ID"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 240 }}
          />
          <TextField
            label="Scanner"
            value={scanner}
            onChange={(event) => {
              setScanner(event.target.value);
              setPage(0);
            }}
            select
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>All scanners</em>
            </MenuItem>
            <MenuItem value="trivy">Trivy</MenuItem>
            <MenuItem value="zap">ZAP</MenuItem>
            <MenuItem value="semgrep">Semgrep</MenuItem>
          </TextField>
          <TextField
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            select
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>All statuses</em>
            </MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
            <MenuItem value="running">Running</MenuItem>
            <MenuItem value="succeeded">Succeeded</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <DataTable minWidth={920}>
        <TableHead>
          <TableRow>
            <TableCell>Job</TableCell>
            <TableCell>Scanner</TableCell>
            <TableCell>Продукт</TableCell>
            <TableCell>Статус</TableCell>
            <TableCell>Статистика</TableCell>
            <TableCell>Создано</TableCell>
            <TableCell align="right">Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableLoadingRows rowCount={6} cellCount={7} />
          ) : data.length === 0 ? (
            <TableEmptyState
              colSpan={7}
              title="Нет импортов"
              description="Импорты появятся после загрузки сканов."
              hint="Попробуйте загрузить скан или изменить фильтры."
            />
          ) : (
            data.map((item) => {
              const statusColor =
                item.status === "succeeded"
                  ? semantic.feedback.success
                  : item.status === "failed"
                    ? semantic.feedback.error
                    : item.status === "running"
                      ? semantic.feedback.warning
                      : semantic.feedback.info;

              return (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <MuiLink component={Link} to={`/imports/${item.id}`} underline="hover">
                      {item.id}
                    </MuiLink>
                  </TableCell>
                  <TableCell>{item.scanner}</TableCell>
                  <TableCell>
                    {item.productName || "—"}
                    {item.productVersion ? ` (${item.productVersion})` : ""}
                  </TableCell>
                  <TableCell>
                    <TableChip
                      label={item.status}
                      sx={{
                        bgcolor: statusColor.subtle,
                        color: statusColor.text,
                        border: `1px solid ${muiAlpha(statusColor.base, 0.4)}`,
                        textTransform: "none",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    New: {item.findingsNew} · Duplicates: {item.duplicatesTotal}
                  </TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleString("ru-RU")}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/imports/${item.id}`}
                      aria-label="Открыть импорт"
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </DataTable>

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

export default ImportJobsList;
