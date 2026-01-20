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
  Link as MuiLink,
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
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCurrentUser } from "../api/auth";
import CodeBlock from "../components/CodeBlock";
import EventTimeline from "../components/EventTimeline";
import RemediationGuidance from "../components/RemediationGuidance";
import { Section } from "../components/Section";
import { TabPanel } from "../components/TabPanel";
import { useFindingDetail } from "../hooks/useFindingDetail";
import { useFindingStatus } from "../hooks/useFindingStatus";
import { useFindingComments } from "../hooks/useFindingComments";
import { useFindingNeighbors } from "../hooks/useFindingNeighbors";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import {
  SEVERITY_STYLES,
  STATUS_COLORS,
  STATUS_LABELS,
  ALL_STATUSES,
} from "../utils/findingConstants";
import { formatDateRu, EventCategory } from "../utils/findingFormatters";
import { FindingComment, SemgrepEvidence } from "../types/findings";

type FindingDetailContentProps = {
  id: string;
  compact?: boolean;
  returnTo?: string | null;
  onClose?: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const extractStringFromRecord = (value: Record<string, unknown>): string | null => {
  const keys = ["url", "link", "name", "id", "value"];
  for (const key of keys) {
    const candidate = toStringValue(value[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const fromPrimitive = toStringValue(item);
      if (fromPrimitive) return [fromPrimitive];
      if (isRecord(item)) {
        const fromRecord = extractStringFromRecord(item);
        return fromRecord ? [fromRecord] : [];
      }
      return [];
    });
  }

  const fromPrimitive = toStringValue(value);
  if (fromPrimitive) return [fromPrimitive];
  if (isRecord(value)) {
    const fromRecord = extractStringFromRecord(value);
    return fromRecord ? [fromRecord] : [];
  }
  return [];
};

const uniq = (values: string[]) => Array.from(new Set(values));

const isProbablyUrl = (value: string) => /^https?:\/\//i.test(value);

export const FindingDetailContent = ({
  id,
  compact = false,
  onClose,
  returnTo: returnToProp,
}: FindingDetailContentProps) => {
  // Tabs and filters
  const [tab, setTab] = useState(0);
  const [eventFilter, setEventFilter] = useState<EventCategory>("all");
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);

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

  // Keyboard navigation (j/k for next/prev)
  useKeyboardNavigation({
    onPrevious: () => {
      if (navigation.neighbors?.prevId) {
        navigation.handleNavigateNeighbor(navigation.neighbors.prevId);
      }
    },
    onNext: () => {
      if (navigation.neighbors?.nextId) {
        navigation.handleNavigateNeighbor(navigation.neighbors.nextId);
      }
    },
    onClose,
    enabled: !navigation.neighborsLoading && Boolean(navigation.returnToUrl),
  });

  // Handle copy to clipboard
  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  // Extract occurrences
  const occurrences: any[] = Array.isArray((data as any)?.occurrences)
    ? (data as any).occurrences
    : [];
  const hasOccurrences = occurrences.length > 0;
  const semgrepEvidence =
    data?.evidence && (data.evidence as SemgrepEvidence).scannerType === "semgrep"
      ? (data.evidence as SemgrepEvidence)
      : null;
  const metadata = semgrepEvidence?.metadata;
  const metadataRecord = isRecord(metadata) ? metadata : null;
  const cweList = uniq(toStringArray(metadataRecord?.cwe));
  const owaspList = uniq(toStringArray(metadataRecord?.owasp));
  const technologyList = uniq(toStringArray(metadataRecord?.technology));
  const category = toStringValue(metadataRecord?.category);
  const subcategory = toStringValue(metadataRecord?.subcategory);
  const references = uniq(toStringArray(metadataRecord?.references));
  const hasStructuredMetadata =
    cweList.length > 0 ||
    owaspList.length > 0 ||
    technologyList.length > 0 ||
    Boolean(category) ||
    Boolean(subcategory) ||
    references.length > 0;

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
              <Tooltip title="Предыдущая (k)">
                <span>
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
                </span>
              </Tooltip>
              <Tooltip title="Следующая (j)">
                <span>
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
                </span>
              </Tooltip>
              {navigation.neighbors && !navigation.neighborsError && (
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {navigation.neighbors.position} из {navigation.neighbors.total}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.disabled",
                      fontSize: "0.65rem",
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.5,
                      bgcolor: "action.hover",
                    }}
                  >
                    j/k
                  </Typography>
                </Stack>
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
        {semgrepEvidence ? <Tab label="Источник (Semgrep)" /> : null}
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

      {/* Tab: Semgrep Evidence */}
      {semgrepEvidence && (
        <TabPanel value={tab} index={1}>
          <Section title="Источник (Semgrep)" dense={compact}>
            <Stack spacing={1.2}>
              <Stack direction="row" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Rule ID
                </Typography>
                <Typography variant="body2">{semgrepEvidence.ruleId || "—"}</Typography>
              </Stack>
              <Stack direction="row" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Path
                </Typography>
                <Typography variant="body2">
                  {semgrepEvidence.path || "—"}
                  {semgrepEvidence.start?.line
                    ? `:${semgrepEvidence.start.line}${
                        semgrepEvidence.start.col ? `:${semgrepEvidence.start.col}` : ""
                      }`
                    : ""}
                  {semgrepEvidence.end?.line
                    ? ` → ${semgrepEvidence.end.line}${
                        semgrepEvidence.end.col ? `:${semgrepEvidence.end.col}` : ""
                      }`
                    : ""}
                </Typography>
              </Stack>
              <Stack direction="row" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Message
                </Typography>
                <Typography variant="body2">{semgrepEvidence.message || "—"}</Typography>
              </Stack>
              <Stack direction="row" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Severity (raw)
                </Typography>
                <Typography variant="body2">{semgrepEvidence.severityRaw || "—"}</Typography>
              </Stack>

              {semgrepEvidence.code && (
                <CodeBlock
                  code={semgrepEvidence.code}
                  language={semgrepEvidence.path?.split('.').pop() || undefined}
                  filename={semgrepEvidence.path || undefined}
                  startLine={semgrepEvidence.start?.line}
                  highlightLines={
                    semgrepEvidence.start?.line && semgrepEvidence.end?.line
                      ? Array.from(
                          { length: semgrepEvidence.end.line - semgrepEvidence.start.line + 1 },
                          (_, i) => semgrepEvidence.start!.line + i
                        )
                      : undefined
                  }
                />
              )}

              {semgrepEvidence.metadata && (
                <Box>
                  <Button size="small" onClick={() => setEvidenceExpanded((prev) => !prev)}>
                    {evidenceExpanded ? "Скрыть metadata" : "Показать metadata"}
                  </Button>
                  <Collapse in={evidenceExpanded} timeout="auto" unmountOnExit>
                    <CodeBlock
                      code={JSON.stringify(semgrepEvidence.metadata, null, 2)}
                      language="json"
                      maxHeight={300}
                    />
                  </Collapse>
                </Box>
              )}
            </Stack>
          </Section>

          {/* Remediation Guidance */}
          <Box sx={{ mt: 2 }}>
            <RemediationGuidance
              evidence={semgrepEvidence}
              title={data.title}
              severity={data.severity}
            />
          </Box>
        </TabPanel>
      )}

      {/* Tab: Occurrences */}
      <TabPanel value={tab} index={semgrepEvidence ? 2 : 1}>
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
      <TabPanel value={tab} index={semgrepEvidence ? 3 : 2}>
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
      <TabPanel value={tab} index={semgrepEvidence ? 4 : 3}>
        <Section title="История изменений" dense={compact}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={eventFilter}
            onChange={(_, v) => v && setEventFilter(v)}
            sx={{ flexWrap: "wrap", mb: 2 }}
          >
            <ToggleButton value="all">Все</ToggleButton>
            <ToggleButton value="status">Статус</ToggleButton>
            <ToggleButton value="comment">Комментарии</ToggleButton>
            <ToggleButton value="dedup">Дубликаты</ToggleButton>
            <ToggleButton value="other">Другое</ToggleButton>
          </ToggleButtonGroup>

          <EventTimeline
            events={data.events ?? []}
            filter={eventFilter}
            compact={compact}
          />
        </Section>
      </TabPanel>

      {/* Tab: Duplicates */}
      {data.duplicates && (
        <TabPanel value={tab} index={semgrepEvidence ? 5 : 4}>
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
