import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchImportJobs } from "../api/importJobs";
import PaginationControl from "../components/PaginationControl";
import { ImportJob } from "../types/imports";

const ImportJobsList = () => {
  const [data, setData] = useState<ImportJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchImportJobs(pageSize, page * pageSize, signal);
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
    [page, pageSize]
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

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Scanner</TableCell>
                <TableCell>Продукт</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Статистика</TableCell>
                <TableCell>Создано</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      Импортов пока нет.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
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
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      New: {item.findingsNew} · Duplicates: {item.duplicatesTotal}
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString("ru-RU")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
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

export default ImportJobsList;
