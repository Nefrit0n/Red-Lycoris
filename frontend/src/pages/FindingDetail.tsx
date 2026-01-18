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
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCurrentUser } from "../api/auth";
import { Section } from "../components/Section";
import { TabPanel } from "../components/TabPanel";
import { useFindingDetail } from "../hooks/useFindingDetail";
import { useFindingStatus } from "../hooks/useFindingStatus";
import { useFindingComments } from "../hooks/useFindingComments";
import { useFindingNeighbors } from "../hooks/useFindingNeighbors";
import {
  SEVERITY_STYLES,
  STATUS_COLORS,
  STATUS_LABELS,
  ALL_STATUSES,
} from "../utils/findingConstants";
import {
  formatEventSummary,
  getEventCategory,
  formatDateRu,
  EventCategory,
} from "../utils/findingFormatters";
import { FindingComment, FindingEvent } from "../types/findings";

type FindingDetailContentProps = {
  id: string;
  compact?: boolean;
  returnTo?: string | null;
  onClose?: () => void;
};

export const FindingDetailContent = ({
  id,
  compact = false,
  onClose,
  returnTo: returnToProp,
}: FindingDetailContentProps) => {
  // Tabs and filters
  const [tab, setTab] = useState(0);
  const [eventFilter, setEventFilter] = useState<EventCategory>("all");
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  // User permissions
  const user = getCurrentUser();
  const canEdit = user?.roles?.includes("admin") || user?.roles?.includes("analyst");

  // Fetch finding detail
  const { data, loading, error, refetch } = useFindingDetail(id);

  // Manage finding status
  const statusManager = useFindingStatus({
    initialStatus: data?.status || "new",
    findingId: id,
    onSuccess: (updated) => {
      // Update local data with the response
      if (updated) {
        refetch();
      }
    },
  });

  // Manage comments
  const commentsManager = useFindingComments({
    findingId: id,
    onSuccess: refetch,
  });

  // Manage navigation
  const navigation = useFindingNeighbors({
    findingId: id,
    returnToProp,
  });

  // Handle copy to clipboard
  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  // Toggle event payload visibility
  const toggleEventPayload = (eventId: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      return next;
    });
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    return data.events.filter((e) =>
      eventFilter === "all" ? true : getEventCategory(e) === eventFilter
    );
  }, [data?.events, eventFilter]);

  // Extract occurrences
  const occurrences: any[] = Array.isArray((data as any)?.occurrences)
    ? (data as any).occurrences
    : [];
  const hasOccurrences = occurrences.length > 0;

  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={compact ? 3 : 8}>
        <CircularProgress aria-label="Загрузка" />
      </Box>
    );
  }

  // Error state
  if (error || !data) {
    return <Alert severity="error">{error || "Данные не найдены"}</Alert>;
  }

  // Build chips for header
  const chips = [
    <Chip
      key="sev"
      label={SEVERITY_STYLES[data.severity].label}
      size="small"
      variant="outlined"
      sx={{
        color: SEVERITY_STYLES[data.severity].color,
        borderColor: SEVERITY_STYLES[data.severity].color,
      }}
    />,
    <Chip
      key="st"
      label={STATUS_LABELS[data.status] ?? data.status}
      size="small"
      color={STATUS_COLORS[data.status]}
    />,
    data.productName ? (
      <Chip key="prod" label={`Продукт: ${data.productName}`} size="small" variant="outlined" />
    ) : null,
    (data as any).occurrenceStatus ? (
      <Chip
        key="occ"
        label={`Occurrence: ${(data as any).occurrenceStatus}`}
        size="small"
        variant="outlined"
      />
    ) : null,
    typeof (data as any).repeatCount === "number" ? (
      <Chip
        key="rep"
        label={`Repeats: ${(data as any).repeatCount}`}
        size="small"
        variant="outlined"
      />
    ) : null,
    (data as any).lastSeenAt ? (
      <Chip
        key="last"
        label={`Last seen: ${formatDateRu((data as any).lastSeenAt)}`}
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
          {navigation.returnToUrl && !compact && (
            <Button variant="text" onClick={navigation.handleBackToResults} sx={{ px: 0, mb: 0.5 }}>
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
          {navigation.returnToUrl && (
            <Stack direction="row" gap={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                disabled={navigation.neighborsLoading || !navigation.neighbors?.prevId}
                onClick={() =>
                  navigation.neighbors?.prevId &&
                  navigation.handleNavigateNeighbor(navigation.neighbors.prevId)
                }
              >
                Предыдущая
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={navigation.neighborsLoading || !navigation.neighbors?.nextId}
                onClick={() =>
                  navigation.neighbors?.nextId &&
                  navigation.handleNavigateNeighbor(navigation.neighbors.nextId)
                }
              >
                Следующая
              </Button>
              {navigation.neighbors && !navigation.neighborsError && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {navigation.neighbors.position} из {navigation.neighbors.total}
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

      {/* Tab: Description */}
      <TabPanel value={tab} index={0}>
        <Section
          title="Описание"
          dense={compact}
          right={
            <Button
              size="small"
              startIcon={<LinkIcon fontSize="small" />}
              onClick={() =>
                handleCopyValue(
                  new URL(navigation.buildFindingLinkWithReturn(id), window.location.origin).toString()
                )
              }
            >
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
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                {data.id}
              </Typography>
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
                value={statusManager.status}
                onChange={(event) => {
                  statusManager.setStatus(event.target.value as any);
                }}
                size="small"
              >
                {ALL_STATUSES.map((k) => (
                  <MenuItem key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 1.5 }}
                onClick={statusManager.handleStatusUpdate}
                disabled={statusManager.statusState === "saving" || !statusManager.statusChanged}
              >
                {statusManager.statusState === "saving" ? "Сохраняем..." : "Сохранить"}
              </Button>

              {statusManager.statusState === "saved" && (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                  Сохранено
                </Alert>
              )}
              {statusManager.statusState === "error" && statusManager.statusError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {statusManager.statusError}
                </Alert>
              )}
            </Section>
          </Box>
        )}
      </TabPanel>

      {/* Tab: Occurrences */}
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
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.08)",
                        }}
                      >
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {occurrences.map((o, idx) => (
                    <Box key={o?.id ?? idx} component="tr">
                      <Box
                        component="td"
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          fontSize: 13,
                        }}
                      >
                        {o?.seenAt ? formatDateRu(o.seenAt) : "—"}
                      </Box>
                      <Box
                        component="td"
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          fontSize: 13,
                        }}
                      >
                        {o?.importJobId ? <Link to={`/imports/${o.importJobId}`}>{o.importJobId}</Link> : "—"}
                      </Box>
                      <Box
                        component="td"
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          fontSize: 13,
                        }}
                      >
                        {o?.scannerType ?? "—"}
                      </Box>
                      <Box
                        component="td"
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          fontSize: 13,
                        }}
                      >
                        {o?.status ?? "—"}
                      </Box>
                      <Box
                        component="td"
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          fontSize: 13,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
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

      {/* Tab: Comments */}
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
                  {c.author || "Пользователь"} · {formatDateRu(c.createdAt)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-line" }}>
                  {c.body}
                </Typography>
              </Box>
            ))}

            {commentsManager.commentError && <Alert severity="error">{commentsManager.commentError}</Alert>}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="Добавить комментарий"
                value={commentsManager.comment}
                onChange={(e) => commentsManager.setComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    commentsManager.handleAddComment();
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
                onClick={commentsManager.handleAddComment}
                disabled={
                  commentsManager.commentState === "saving" || !commentsManager.comment.trim()
                }
                sx={{ minWidth: 140 }}
              >
                {commentsManager.commentState === "saving" ? "..." : "Добавить"}
              </Button>
            </Stack>
          </Stack>
        </Section>
      </TabPanel>

      {/* Tab: Events History */}
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
                    {e.actor || "system"} · {formatDateRu(e.createdAt)}
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

      {/* Tab: Duplicates */}
      {data.duplicates && (
        <TabPanel value={tab} index={4}>
          <Section title="Дубликаты" dense={compact}>
            {data.duplicates.master.id !== data.id ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  Master:{" "}
                  <Link to={navigation.buildFindingLinkWithReturn(data.duplicates.master.id)}>
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
                      <Link to={navigation.buildFindingLinkWithReturn(dup.id)}>{dup.title}</Link>{" "}
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

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <FindingDetailContent id={id} compact={false} />
    </Container>
  );
};

export default FindingDetailPage;
