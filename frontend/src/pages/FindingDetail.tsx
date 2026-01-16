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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { addFindingComment, fetchFindingDetail, updateFindingStatus } from "../api/findings";
import { getCurrentUser } from "../api/auth";
import { FindingComment, FindingDetail, FindingEvent, FindingSeverity, FindingStatus } from "../types/findings";

const severityStyles: Record<FindingSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "#2e7d32" },
  medium: { label: "Medium", color: "#ed6c02" },
  high: { label: "High", color: "#d32f2f" },
  critical: { label: "Critical", color: "#7b1fa2" },
};

const statusColors: Record<FindingStatus, "default" | "info" | "success" | "warning"> = {
  new: "info",
  under_review: "warning",
  confirmed: "success",
  false_positive: "default",
  out_of_scope: "default",
  risk_accepted: "warning",
  mitigated: "success",
  duplicate: "default",
};

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<FindingStatus | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const user = getCurrentUser();
  const canEdit =
    user?.roles?.includes("admin") || user?.roles?.includes("analyst");

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

  const handleAddComment = async () => {
    if (!id || !comment.trim()) return;
    setCommentLoading(true);
    setMessage(null);
    try {
      await addFindingComment(id, comment.trim());
      setComment("");
      await fetchDetail();
    } catch (commentError) {
      if (commentError instanceof Error) {
        setMessage(commentError.message);
      } else {
        setMessage("Не удалось добавить комментарий");
      }
    } finally {
      setCommentLoading(false);
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
              {data.fingerprint && (
                <Chip label={`Fingerprint: ${data.fingerprint}`} variant="outlined" />
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Комментарии
            </Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              {data.comments.length === 0 && (
                <Typography color="text.secondary">
                  Комментариев пока нет.
                </Typography>
              )}
              {data.comments.map((item: FindingComment) => (
                <Box key={item.id} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2">
                    {item.author || "Пользователь"} · {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {item.body}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 3 }}>
              <TextField
                label="Добавить комментарий"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleAddComment}
                disabled={commentLoading || !comment.trim()}
              >
                {commentLoading ? "Отправка..." : "Добавить"}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              История изменений
            </Typography>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {data.events.length === 0 && (
                <Typography color="text.secondary">История пуста.</Typography>
              )}
              {data.events.map((event: FindingEvent) => (
                <Box key={event.id} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2">
                    {event.eventType} · {event.actor || "system"} · {new Date(event.createdAt).toLocaleString("ru-RU")}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {JSON.stringify(event.payload)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {data.duplicates && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Дубликаты
              </Typography>
              <Typography variant="body2">
                Master: {data.duplicates.master.title} ({data.duplicates.master.id})
              </Typography>
              {data.duplicates.duplicates.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Дубликатов нет.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  {data.duplicates.duplicates.map((dup) => (
                    <Typography key={dup.id} variant="body2">
                      {dup.title} · {dup.id}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {canEdit && (
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
                <MenuItem value="under_review">Under review</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="false_positive">False positive</MenuItem>
                <MenuItem value="out_of_scope">Out of scope</MenuItem>
                <MenuItem value="risk_accepted">Risk accepted</MenuItem>
                <MenuItem value="mitigated">Mitigated</MenuItem>
                <MenuItem value="duplicate">Duplicate</MenuItem>
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
          )}

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: canEdit ? 3 : 0 }}>
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
            {data.importJobId && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Import Job ID: {data.importJobId}
              </Typography>
            )}
            {data.assigneeId && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Assignee ID: {data.assigneeId}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FindingDetailPage;
