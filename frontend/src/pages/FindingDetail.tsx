import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Grid,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  addFindingComment,
  fetchFindingDetail,
  fetchFindingNeighbors,
  updateFindingStatus,
} from "../api/findings";
import { getCurrentUser } from "../api/auth";
import {
  FindingComment,
  FindingDetail,
  FindingEvent,
  FindingNeighbors,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

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

const statusLabels: Record<FindingStatus, string> = {
  new: "New",
  under_review: "Under review",
  confirmed: "Confirmed",
  false_positive: "False positive",
  out_of_scope: "Out of scope",
  risk_accepted: "Risk accepted",
  mitigated: "Mitigated",
  duplicate: "Duplicate",
};

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<FindingStatus | "">("");
  const [statusState, setStatusState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusError, setStatusError] = useState<string | null>(null);

  const [comment, setComment] = useState("");
  const [commentState, setCommentState] = useState<"idle" | "saving" | "error">("idle");
  const [commentError, setCommentError] = useState<string | null>(null);

  const [neighbors, setNeighbors] = useState<FindingNeighbors | null>(null);
  const [neighborsLoading, setNeighborsLoading] = useState(false);
  const [neighborsError, setNeighborsError] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState<"all" | "status" | "comment" | "dedup" | "other">("all");
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const user = getCurrentUser();
  const canEdit = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("returnTo");
    if (!raw) return null;

    // URLSearchParams уже декодит, но оставим try/catch на всякий случай
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [location.search]);

  const returnToUrl = useMemo(() => {
    if (!returnTo) return null;
    try {
      return new URL(returnTo, window.location.origin);
    } catch {
      return null;
    }
  }, [returnTo]);

  const returnToParam = returnToUrl
    ? encodeURIComponent(`${returnToUrl.pathname}${returnToUrl.search}`)
    : "";
  const returnToQuery = returnToUrl?.search.replace(/^\?/, "") ?? "";

  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  const getEventCategory = (event: FindingEvent) => {
    if (event.eventType.startsWith("status")) return "status";
    if (event.eventType.startsWith("comment")) return "comment";
    if (event.eventType.startsWith("duplicate")) return "dedup";
    return "other";
  };

  const formatEventSummary = (event: FindingEvent) => {
    switch (event.eventType) {
      case "status_changed": {
        const fromValue = typeof event.payload.from === "string" ? event.payload.from : "";
        const toValue = typeof event.payload.to === "string" ? event.payload.to : "";
        const fromLabel = (statusLabels[fromValue as FindingStatus] ?? fromValue) || "—";
        const toLabel = (statusLabels[toValue as FindingStatus] ?? toValue) || "—";
        return `Статус: ${fromLabel} → ${toLabel}`;
      }
      case "comment_added":
        return "Комментарий добавлен";
      case "assignee_changed": {
        const fromValue = typeof event.payload.from === "string" ? event.payload.from : "";
        const toValue = typeof event.payload.to === "string" ? event.payload.to : "";
        return `Assignee: ${fromValue || "—"} → ${toValue || "—"}`;
      }
      case "duplicate_promoted":
        return "Дубликат: назначен master";
      case "duplicate_unlinked":
        return "Дубликат: отвязан от master";
      case "deleted":
        return "Находка удалена";
      default:
        return event.eventType;
    }
  };

  // ✅ СЕЙФОВО: на первом рендере data = null, но массивы всегда есть
  const events = useMemo(() => data?.events ?? [], [data]);
  const comments = useMemo(() => data?.comments ?? [], [data]);

  const filteredEvents = useMemo(() => {
    if (eventFilter === "all") return events;
    return events.filter((event) => getEventCategory(event) === eventFilter);
  }, [events, eventFilter]);

  const toggleEventPayload = (eventId: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleBackToResults = () => {
    if (!returnToUrl) return;
    navigate(`${returnToUrl.pathname}${returnToUrl.search}`);
  };

  const handleNavigateNeighbor = (neighborId: string) => {
    if (!neighborId) return;
    const query = returnToParam ? `?returnTo=${returnToParam}` : "";
    navigate(`/findings/${neighborId}${query}`);
  };

  const buildFindingLink = (findingId: string) => {
    const query = returnToParam ? `?returnTo=${returnToParam}` : "";
    return `/findings/${findingId}${query}`;
  };

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
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
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

  useEffect(() => {
    if (!id || !returnToUrl) {
      setNeighbors(null);
      return;
    }

    const controller = new AbortController();

    const loadNeighbors = async () => {
      setNeighborsLoading(true);
      setNeighborsError(null);
      try {
        const response = await fetchFindingNeighbors(id, returnToQuery, controller.signal as any);
        // ↑ если у тебя fetchFindingNeighbors не принимает signal — убери 3-й аргумент и просто оставь controller для future
        setNeighbors(response);
      } catch (neighborsLoadError) {
        if (!(neighborsLoadError instanceof DOMException && neighborsLoadError.name === "AbortError")) {
          setNeighborsError("Не удалось загрузить соседние находки");
        }
      } finally {
        setNeighborsLoading(false);
      }
    };

    loadNeighbors();
    return () => controller.abort();
  }, [id, returnToQuery, returnToUrl]);

  useEffect(() => {
    if (statusState === "saved") {
      const timer = window.setTimeout(() => setStatusState("idle"), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [statusState]);

  const handleStatusUpdate = async () => {
    if (!id || !status) return;
    setStatusState("saving");
    setStatusError(null);

    try {
      const updated = await updateFindingStatus(id, status);
      setData(updated);
      setStatusState("saved");
    } catch (updateError) {
      const errorMessage =
        updateError instanceof Error && updateError.message
          ? `Не удалось сохранить: ${updateError.message}`
          : "Не удалось сохранить";
      setStatusError(errorMessage);
      setStatusState("error");
    }
  };

  const handleAddComment = async () => {
    if (!id || !comment.trim()) return;
    setCommentState("saving");
    setCommentError(null);
    try {
      await addFindingComment(id, comment.trim());
      setComment("");
      await fetchDetail();
      setCommentState("idle");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Не удалось добавить комментарий";
      setCommentError(errorMessage);
      setCommentState("error");
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

  const statusChanged = status !== "" && status !== data.status;

  const sev = severityStyles[data.severity] ?? {
    label: String(data.severity ?? "unknown"),
    color: "#666",
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {returnToUrl && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Button variant="text" onClick={handleBackToResults}>
            ← К результатам
          </Button>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              disabled={neighborsLoading || !neighbors?.prevId}
              onClick={() => neighbors?.prevId && handleNavigateNeighbor(neighbors.prevId)}
            >
              Предыдущая
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={neighborsLoading || !neighbors?.nextId}
              onClick={() => neighbors?.nextId && handleNavigateNeighbor(neighbors.nextId)}
            >
              Следующая
            </Button>
            {neighbors && !neighborsError && (
              <Typography variant="body2" color="text.secondary">
                {neighbors.position} из {neighbors.total}
              </Typography>
            )}
          </Stack>
        </Stack>
      )}

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
                label={sev.label}
                sx={{ color: sev.color, borderColor: sev.color }}
                variant="outlined"
              />
              <Chip label={data.status} color={statusColors[data.status] ?? "default"} sx={{ textTransform: "capitalize" }} />
              {data.productName && <Chip label={`Продукт: ${data.productName}`} variant="outlined" />}
              {data.fingerprint && <Chip label={`Fingerprint: ${data.fingerprint}`} variant="outlined" />}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Комментарии
            </Typography>

            <Stack spacing={2} sx={{ mt: 2 }}>
              {comments.length === 0 && (
                <Typography color="text.secondary">Комментариев пока нет.</Typography>
              )}

              {comments.map((item: FindingComment) => (
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

            {commentError && (
              <Alert
                severity="error"
                sx={{ mt: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={handleAddComment}>
                    Retry
                  </Button>
                }
              >
                {commentError}
              </Alert>
            )}

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 3 }}>
              <TextField
                label="Добавить комментарий"
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  if (commentError) setCommentError(null);
                  if (commentState === "error") setCommentState("idle");
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    handleAddComment();
                  }
                }}
                multiline
                minRows={2}
                fullWidth
                helperText="Ctrl+Enter / Cmd+Enter — отправить"
              />
              <Button
                variant="contained"
                onClick={handleAddComment}
                disabled={commentState === "saving" || !comment.trim()}
              >
                {commentState === "saving" ? "Добавляем..." : "Добавить"}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              История изменений
            </Typography>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={eventFilter}
              onChange={(_, value) => value && setEventFilter(value)}
              sx={{ mt: 1, flexWrap: "wrap" }}
            >
              <ToggleButton value="all">Все</ToggleButton>
              <ToggleButton value="status">Статус</ToggleButton>
              <ToggleButton value="comment">Комментарии</ToggleButton>
              <ToggleButton value="dedup">Дубликаты</ToggleButton>
              <ToggleButton value="other">Другое</ToggleButton>
            </ToggleButtonGroup>

            <Stack spacing={1} sx={{ mt: 2 }}>
              {filteredEvents.length === 0 && (
                <Typography color="text.secondary">История пуста.</Typography>
              )}

              {filteredEvents.map((event: FindingEvent) => (
                <Box key={event.id} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">{formatEventSummary(event)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {event.actor || "system"} · {new Date(event.createdAt).toLocaleString("ru-RU")}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Тип: {event.eventType}
                    </Typography>
                    <Button size="small" onClick={() => toggleEventPayload(event.id)}>
                      {expandedEventIds.has(event.id) ? "Скрыть raw payload" : "Показать raw payload"}
                    </Button>
                  </Stack>

                  <Collapse in={expandedEventIds.has(event.id)} timeout="auto" unmountOnExit>
                    <Box
                      component="pre"
                      sx={{
                        mt: 1,
                        mb: 0,
                        p: 2,
                        borderRadius: 1,
                        backgroundColor: "action.hover",
                        overflowX: "auto",
                        fontSize: "0.75rem",
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2)}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Stack>
          </Paper>

          {data.duplicates?.master?.id && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Дубликаты
              </Typography>

              {data.duplicates.master.id !== data.id ? (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Master:{" "}
                    <MuiLink component={Link} to={buildFindingLink(data.duplicates.master.id)}>
                      {data.duplicates.master.title}
                    </MuiLink>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Сиблинги: {data.duplicates.duplicates?.length ?? 0}
                  </Typography>
                </Stack>
              ) : (
                <>
                  {(data.duplicates.duplicates?.length ?? 0) === 0 ? (
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      Дубликатов нет.
                    </Typography>
                  ) : (
                    <Stack spacing={1} sx={{ mt: 2 }}>
                      {data.duplicates.duplicates.map((dup) => (
                        <Typography key={dup.id} variant="body2">
                          <MuiLink component={Link} to={buildFindingLink(dup.id)}>
                            {dup.title}
                          </MuiLink>{" "}
                          · {dup.id}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </>
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
                onChange={(event) => {
                  setStatus(event.target.value as FindingStatus);
                  setStatusState("idle");
                  setStatusError(null);
                }}
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
                disabled={statusState === "saving" || !statusChanged}
              >
                {statusState === "saving" ? "Saving..." : "Сохранить"}
              </Button>

              {statusState === "saved" && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Saved
                </Alert>
              )}

              {statusState === "error" && statusError && (
                <Alert
                  severity="error"
                  sx={{ mt: 2 }}
                  action={
                    <Button color="inherit" size="small" onClick={handleStatusUpdate}>
                      Retry
                    </Button>
                  }
                >
                  {statusError}
                </Alert>
              )}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: canEdit ? 3 : 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Метаданные
            </Typography>

            <Stack spacing={1}>
              <Typography variant="body2">
                Создано: {new Date(data.createdAt).toLocaleString("ru-RU")}
              </Typography>
              <Typography variant="body2">
                Обновлено: {new Date(data.updatedAt).toLocaleString("ru-RU")}
              </Typography>

              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">Finding ID: {data.id}</Typography>
                <Tooltip title="Скопировать ID">
                  <IconButton size="small" onClick={() => handleCopyValue(data.id)}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>

              {data.fingerprint && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2">Fingerprint: {data.fingerprint}</Typography>
                  <Tooltip title="Скопировать fingerprint">
                    <IconButton size="small" onClick={() => handleCopyValue(data.fingerprint ?? "")}>
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {data.productId && (
                <Typography variant="body2">
                  Product ID:{" "}
                  <MuiLink component={Link} to={`/products/${data.productId}`}>
                    {data.productId}
                  </MuiLink>
                </Typography>
              )}

              {data.importJobId && (
                <Typography variant="body2">
                  Import Job ID:{" "}
                  <MuiLink component={Link} to={`/imports/${data.importJobId}`}>
                    {data.importJobId}
                  </MuiLink>
                </Typography>
              )}

              {data.assigneeId && <Typography variant="body2">Assignee ID: {data.assigneeId}</Typography>}

              <Button
                size="small"
                startIcon={<LinkIcon fontSize="small" />}
                onClick={() => handleCopyValue(window.location.href)}
              >
                Copy permalink
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FindingDetailPage;
