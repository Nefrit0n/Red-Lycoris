import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchImportJobDetail } from "../api/importJobs";
import { ImportJobDetail as ImportJobDetailType } from "../types/imports";

const ImportJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImportJobDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetchImportJobDetail(id, signal);
        setData(response);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить импорт.");
        }
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error || "Импорт не найден"}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Import Job {data.id}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Статус: {data.status}
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Метаданные
          </Typography>
          <Typography variant="body2">
            Scanner: {data.scanner}
          </Typography>
          <Typography variant="body2">
            Продукт: {data.productName || "—"}
            {data.productVersion ? ` (${data.productVersion})` : ""}
          </Typography>
          {data.productIdentifier && (
            <Typography variant="body2">Identifier: {data.productIdentifier}</Typography>
          )}
          <Typography variant="body2">
            Создано: {new Date(data.createdAt).toLocaleString("ru-RU")}
          </Typography>
          {data.startedAt && (
            <Typography variant="body2">
              Начато: {new Date(data.startedAt).toLocaleString("ru-RU")}
            </Typography>
          )}
          {data.finishedAt && (
            <Typography variant="body2">
              Завершено: {new Date(data.finishedAt).toLocaleString("ru-RU")}
            </Typography>
          )}
          <Typography variant="body2">
            Findings total: {data.findingsTotal}
          </Typography>
          <Typography variant="body2">
            New: {data.findingsNew} · Duplicates: {data.duplicatesTotal}
          </Typography>
          {data.errorMessage && (
            <Alert severity="error">{data.errorMessage}</Alert>
          )}
          <Button
            variant="outlined"
            onClick={() =>
              navigate({
                pathname: "/findings",
                search: `?import_job_id=${data.id}`,
              })
            }
          >
            Посмотреть findings импорта
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ImportJobDetail;
