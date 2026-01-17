import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
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

const Section = ({
  title,
  right,
  children,
  dense,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}) => (
  <Paper
    variant="outlined"
    sx={{
      p: dense ? 2 : 3,
      borderRadius: 2.5,
    }}
  >
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      {right}
    </Stack>
    <Box sx={{ mt: dense ? 1 : 1.5 }}>{children}</Box>
  </Paper>
);

const TabPanel = ({ value, index, children }: { value: number; index: number; children: React.ReactNode }) => {
  if (value !== index) return null;
  return <Box sx={{ mt: 2 }}>{children}</Box>;
};

type FindingDetailContentProps = {
  id: string;
  compact?: boolean;
  onClose?: () => void; // удобно для Drawer
};

export const FindingDetailContent = ({ id, compact = false, onClose }: FindingDetailContentProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState(0);

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

  const returnToParam = returnToUrl ? encodeURIComponent(`${returnToUrl.pathname}${returnToUrl.search}`) : "";
  const returnToQuery = returnToUrl?.search.replace(/^\?/, "") ?? "";

  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  const fetchDetail = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFindingDetail(id, signal);
      setData(response);
      setStatus(response.status);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("Не удалось загрузить детали находки.");
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

  useEffect(() => {
    if (!returnToUrl) {
      setNeighbors(null);
      return;
    }
    const load = async () => {
      setNeighborsLoading(true);
      setNeighborsError(null);
      try {
        const response = await fetchFindingNeighbors(id, returnToQuery);
        setNeighbors(response);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setNeighborsError("Не удалось загрузить соседние находки");
        }
      } finally {
        setNeighborsLoading(false);
      }
    };
    load();
  }, [id, returnToQuery, returnToUrl]);

  useEffect(() => {
    if (statusState !== "saved") return;
    const t = window.setTimeout(() => setStatusState("idle"), 1500);
    return () => window.clearTimeout(t);
  }, [statusState]);

  const handleStatusUpdate = async () => {
    if (!status) return;
    setStatusState("saving");
    setStatusError(null);
    try {
      const updated = await updateFindingStatus(id, status);
      setData(updated);
      setStatusState("saved");
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Не удалось сохранить";
      setStatusError(msg);
      setStatusState("error");
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setCommentState("saving");
    setCommentError(null);
    try {
      await addFindingComment(id, comment.trim());
      setComment("");
      await fetchDetail();
      setCommentState("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось добавить комментарий";
      setCommentError(msg);
      setCommentState("error");
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

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    return data.events.filter((e) => (eventFilter === "all" ? true : getEventCategory(e) === eventFilter));
  }, [data?.events, eventFilter]);

  const toggleEventPayload = (eventId: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={compact ? 3 : 8}>
        <CircularProgress aria-label="Загрузка" />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{error || "Данные не найдены"}</Alert>;
  }

  const statusChanged = status !== "" && status !== data.status;

  // occurrences (чтобы не упасть, даже если типы отличаются)
  const occurrences: any[] = Array.isArray((data as any).occurrences) ? (data as any).occurrences : [];
  const hasOccurrences = occurrences.length > 0;

  const chips = [
    <Chip
      key="sev"
      label={severityStyles[data.severity].label}
      size="small"
      variant="outlined"
      sx={{ color: severityStyles[data.severity].color, borderColor: severityStyles[data.severity].color }}
    />,
    <Chip key="st" label={statusLabels[data.status] ?? data.status} size="small" color={statusColors[data.status]} />,
    data.productName ? <Chip key="prod" label={`Продукт: ${data.productName}`} size="small" variant="outlined" /> : null,
    (data as any).occurrenceStatus ? (
      <Chip key="occ" label={`Occurrence: ${(data as any).occurrenceStatus}`} size="small" variant="outlined" />
    ) : null,
    typeof (data as any).repeatCount === "number" ? (
      <Chip key="rep" label={`Repeats: ${(data as any).repeatCount}`} size="small" variant="outlined" />
    ) : null,
    (data as any).lastSeenAt ? (
      <Chip
        key="last"
        label={`Last seen: ${new Date((data as any).lastSeenAt).toLocaleString("ru-RU")}`}
        size="small"
        variant="outlined"
      />
    ) : null,
  ].filter(Boolean);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          {returnToUrl && !compact && (
            <Button variant="text" onClick={handleBackToResults} sx={{ px: 0, mb: 0.5 }}>
              ← К результатам
            </Button>
          )}
          <Typography variant={compact ? "h6" : "h5"} sx={{ lineHeight: 1.2, wordBreak: "break-word" }}>
            {data.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Детали находки и управление статусом.
          </Typography>

          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
            {chips}
          </Stack>
        </Box>

        <Stack direction="row" alignItems="center" gap={1}>
          {returnToUrl && (
            <Stack direction="row" gap={1} alignItems="center">
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
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {neighbors.position} из {neighbors.total}
                </Typography>
              )}
            </Stack>
          )}

          {onClose && (
            <Tooltip title="Закрыть">
              <IconButton onClick={onClose} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab label="Описание" />
        <Tab label={`Occurrences${hasOccurrences ? ` (${occurrences.length})` : ""}`} />
        <Tab label={`Комментарии (${data.comments?.length ?? 0})`} />
        <Tab label={`История (${data.events?.length ?? 0})`} />
        {data.duplicates ? <Tab label="Дубликаты" /> : null}
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Section
          title="Описание"
          dense={compact}
          right={
            <Button size="small" startIcon={<LinkIcon fontSize="small" />} onClick={() => handleCopyValue(window.location.href)}>
              Copy link
            </Button>
          }
        >
          <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
            {data.description || "Описание отсутствует."}
          </Typography>

          <Stack spacing={1.2} sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 92 }}>
                Finding ID
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>{data.id}</Typography>
              <Tooltip title="Скопировать">
                <IconButton size="small" onClick={() => handleCopyValue(data.id)}>
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Stack>

            {data.fingerprint && (
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 92 }}>
                  Fingerprint
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    wordBreak: "break-all",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {data.fingerprint}
                </Typography>
                <Tooltip title="Скопировать">
                  <IconButton size="small" onClick={() => handleCopyValue(data.fingerprint ?? "")}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        </Section>

        {canEdit && (
          <Box sx={{ mt: 2 }}>
            <Section title="Управление статусом" dense={compact}>
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
                size="small"
              >
                {Object.keys(statusLabels).map((k) => (
                  <MenuItem key={k} value={k}>
                    {statusLabels[k as FindingStatus]}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 1.5 }}
                onClick={handleStatusUpdate}
                disabled={statusState === "saving" || !statusChanged}
              >
                {statusState === "saving" ? "Сохраняем..." : "Сохранить"}
              </Button>

              {statusState === "saved" && <Alert severity="success" sx={{ mt: 1.5 }}>Сохранено</Alert>}
              {statusState === "error" && statusError && <Alert severity="error" sx={{ mt: 1.5 }}>{statusError}</Alert>}
            </Section>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Section title="Occurrences / Repeats" dense={compact}>
          {!hasOccurrences ? (
            <Typography variant="body2" color="text.secondary">
              Нет данных по occurrences.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                <Box component="thead">
                  <Box component="tr" sx={{ textAlign: "left" }}>
                    {["Seen at", "Import Job", "Scanner", "Status", "Snippet"].map((h) => (
                      <Box
                        key={h}
                        component="th"
                        style={{ fontWeight: 600, fontSize: 12, padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
                      >
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {occurrences.map((o, idx) => (
                    <Box key={o?.id ?? idx} component="tr">
                      <Box component="td" style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
                        {o?.seenAt ? new Date(o.seenAt).toLocaleString("ru-RU") : "—"}
                      </Box>
                      <Box component="td" style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
                        {o?.importJobId ? (
                          <Link to={`/imports/${o.importJobId}`}>{o.importJobId}</Link>
                        ) : (
                          "—"
                        )}
                      </Box>
                      <Box component="td" style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
                        {o?.scannerType ?? "—"}
                      </Box>
                      <Box component="td" style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
                        {o?.status ?? "—"}
                      </Box>
                      <Box component="td" style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
                        <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {o?.snippet ?? "—"}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Section>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Section title="Комментарии" dense={compact}>
          <Stack spacing={1.2}>
            {(data.comments ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Комментариев пока нет.
              </Typography>
            )}

            {(data.comments ?? []).map((c: FindingComment) => (
              <Box key={c.id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">
                  {c.author || "Пользователь"} · {new Date(c.createdAt).toLocaleString("ru-RU")}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-line" }}>
                  {c.body}
                </Typography>
              </Box>
            ))}

            {commentError && <Alert severity="error">{commentError}</Alert>}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="Добавить комментарий"
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError) setCommentError(null);
                  if (commentState === "error") setCommentState("idle");
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                multiline
                minRows={2}
                size="small"
                fullWidth
                helperText="Ctrl+Enter / Cmd+Enter — отправить"
              />
              <Button
                variant="contained"
                onClick={handleAddComment}
                disabled={commentState === "saving" || !comment.trim()}
                sx={{ minWidth: 140 }}
              >
                {commentState === "saving" ? "..." : "Добавить"}
              </Button>
            </Stack>
          </Stack>
        </Section>
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <Section title="История изменений" dense={compact}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={eventFilter}
            onChange={(_, v) => v && setEventFilter(v)}
            sx={{ flexWrap: "wrap" }}
          >
            <ToggleButton value="all">Все</ToggleButton>
            <ToggleButton value="status">Статус</ToggleButton>
            <ToggleButton value="comment">Комментарии</ToggleButton>
            <ToggleButton value="dedup">Дубликаты</ToggleButton>
            <ToggleButton value="other">Другое</ToggleButton>
          </ToggleButtonGroup>

          <Stack spacing={1.2} sx={{ mt: 2 }}>
            {filteredEvents.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                История пуста.
              </Typography>
            )}

            {filteredEvents.map((e: FindingEvent) => (
              <Box key={e.id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatEventSummary(e)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {e.actor || "system"} · {new Date(e.createdAt).toLocaleString("ru-RU")}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Тип: {e.eventType}
                  </Typography>
                  <Button size="small" onClick={() => toggleEventPayload(e.id)}>
                    {expandedEventIds.has(e.id) ? "Скрыть payload" : "Показать payload"}
                  </Button>
                </Stack>

                <Collapse in={expandedEventIds.has(e.id)} timeout="auto" unmountOnExit>
                  <Box
                    component="pre"
                    sx={{
                      mt: 1,
                      mb: 0,
                      p: 1.5,
                      borderRadius: 1.5,
                      backgroundColor: "action.hover",
                      overflowX: "auto",
                      fontSize: "0.75rem",
                    }}
                  >
                    {JSON.stringify(e.payload, null, 2)}
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Stack>
        </Section>
      </TabPanel>

      {data.duplicates && (
        <TabPanel value={tab} index={4}>
          <Section title="Дубликаты" dense={compact}>
            {data.duplicates.master.id !== data.id ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  Master:{" "}
                  <Link to={buildFindingLink(data.duplicates.master.id)}>
                    {data.duplicates.master.title}
                  </Link>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Сиблинги: {data.duplicates.duplicates.length}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {data.duplicates.duplicates.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Дубликатов нет.
                  </Typography>
                ) : (
                  data.duplicates.duplicates.map((dup) => (
                    <Typography key={dup.id} variant="body2">
                      <Link to={buildFindingLink(dup.id)}>{dup.title}</Link>{" "}
                      <Typography component="span" variant="caption" color="text.secondary">
                        · {dup.id}
                      </Typography>
                    </Typography>
                  ))
                )}
              </Stack>
            )}
          </Section>
        </TabPanel>
      )}
    </Box>
  );
};

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Некорректный ID</Alert>
      </Container>
    );
  }

  // ✅ более компактная “страница”, без гигантских отступов
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <FindingDetailContent id={id} compact={false} />
    </Container>
  );
};

export default FindingDetailPage;
