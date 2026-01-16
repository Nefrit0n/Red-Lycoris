import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchFindingDetail, updateFindingStatus } from "../api/findings";
import { FindingDetail, FindingSeverity, FindingStatus } from "../types/findings";

const severityStyles: Record<FindingSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "#2e7d32" },
  medium: { label: "Medium", color: "#ed6c02" },
  high: { label: "High", color: "#d32f2f" },
  critical: { label: "Critical", color: "#7b1fa2" },
};

const statusColors: Record<FindingStatus, "default" | "info" | "success" | "warning"> = {
  new: "info",
  duplicate: "default",
  resolved: "success",
  ignored: "warning",
};

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<FindingStatus | "">("");
  const [message, setMessage] = useState<string | null>(null);

  const fetchDetail = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFindingDetail(id, signal);
      setData(response);
      setStatus(response.status);
    } catch (fetchError) {
      if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
        setError("Не удалось загрузить детали уязвимости.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

  const handleStatusUpdate = async () => {
    if (!id || !status) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const updated = await updateFindingStatus(id, status);
      setData(updated);
      setMessage("Статус успешно обновлен");
    } catch (updateError) {
      if (updateError instanceof Error) {
        setMessage(updateError.message);
      } else {
        setMessage("Не удалось обновить статус");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress aria-label="Загрузка" />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error || "Данные не найдены"}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {data.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Детальная информация о находке и управление ее статусом.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Описание
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-line" }}>
              {data.description || "Описание отсутствует."}
            </Typography>

            <Box mt={3} display="flex" flexWrap="wrap" gap={2}>
              <Chip
                label={severityStyles[data.severity].label}
                sx={{
                  color: severityStyles[data.severity].color,
                  borderColor: severityStyles[data.severity].color,
                }}
                variant="outlined"
              />
              <Chip
                label={data.status}
                color={statusColors[data.status]}
                sx={{ textTransform: "capitalize" }}
              />
              {data.productName && (
                <Chip label={`Продукт: ${data.productName}`} variant="outlined" />
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Управление статусом
            </Typography>
            <TextField
              select
              fullWidth
              label="Статус"
              value={status}
              onChange={(event) => setStatus(event.target.value as FindingStatus)}
              SelectProps={{ native: false }}
              margin="dense"
            >
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="duplicate">Duplicate</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="ignored">Ignored</MenuItem>
            </TextField>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              onClick={handleStatusUpdate}
              disabled={actionLoading}
            >
              {actionLoading ? "Сохранение..." : "Сохранить"}
            </Button>
            {message && (
              <Alert severity={message.includes("успешно") ? "success" : "error"} sx={{ mt: 2 }}>
                {message}
              </Alert>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Метаданные
            </Typography>
            <Typography variant="body2">
              Создано: {new Date(data.createdAt).toLocaleString("ru-RU")}
            </Typography>
            <Typography variant="body2">
              Обновлено: {new Date(data.updatedAt).toLocaleString("ru-RU")}
            </Typography>
            {data.productId && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Product ID: {data.productId}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FindingDetailPage;
