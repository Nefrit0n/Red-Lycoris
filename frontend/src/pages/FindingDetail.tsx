import {
  Alert,
  Box,
  Button,
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
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { primitives, semantic } from "../design-system/tokens/colors";
import { getCurrentUser } from "../api/auth";
import CodeBlock from "../components/CodeBlock";
import EventTimeline from "../components/EventTimeline";
import RemediationGuidance from "../components/RemediationGuidance";
import { Section } from "../components/Section";
import { TabPanel } from "../components/TabPanel";
import BduPanel from "../components/intel/BduPanel";
import { useFindingDetail } from "../hooks/useFindingDetail";
import { useFindingStatus } from "../hooks/useFindingStatus";
import { useFindingComments } from "../hooks/useFindingComments";
import { useFindingNeighbors } from "../hooks/useFindingNeighbors";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import { resolveFindingDetails } from "../utils/findingDetails";
import {
  SEVERITY_STYLES,
  STATUS_LABELS,
  ALL_STATUSES,
  RISK_BAND_COLORS,
  RISK_BAND_LABELS,
} from "../utils/findingConstants";
import { formatDateRu, EventCategory, formatPercent01 } from "../utils/findingFormatters";
import { FindingComment, SemgrepEvidence, FindingDetailsSecrets, FindingDetailsIAC, FindingDetailsContainer, FindingDetailsDAST } from "../types/findings";

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

const slaClosedStatuses = new Set([
  "mitigated",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "duplicate",
]);

const uniq = (values: string[]) => Array.from(new Set(values));

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
  const [factorsExpanded, setFactorsExpanded] = useState(false);
  // Collapsible sections - default closed for cleaner view
  const [riskExpanded, setRiskExpanded] = useState(false);
  const [slaExpanded, setSlaExpanded] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);

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
    enabled: !loading,
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

  // Extract occurrences
  const occurrences = Array.isArray(data.occurrences) ? data.occurrences : [];
  const hasOccurrences = occurrences.length > 0;
  const semgrepEvidence =
    data.evidence && (data.evidence as SemgrepEvidence).scannerType === "semgrep"
      ? (data.evidence as SemgrepEvidence)
      : null;
  const intelSummary = data.intel_summary ?? null;
  const intelDetails = data.intel_details ?? null;
  const intelIdentifiers =
    intelDetails?.identifiers?.length
      ? intelDetails.identifiers
      : intelSummary?.identifiers ?? [];
  const cvssScore =
    typeof intelSummary?.cvss?.score === "number" ? intelSummary?.cvss?.score : null;
  const cvssVersion = intelSummary?.cvss?.version ?? null;
  const epssScore =
    typeof intelSummary?.epss?.score === "number" ? intelSummary?.epss?.score : null;
  const epssPercentile =
    typeof intelSummary?.epss?.percentile === "number"
      ? intelSummary?.epss?.percentile
      : null;
  const kevFlag = Boolean(intelSummary?.kev);
  const intelReferences = intelDetails?.references ?? [];
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

  const resolvedDetails = resolveFindingDetails(data);
  const scaDetails = resolvedDetails.category === "SCA" ? resolvedDetails.details : null;
  const sastDetails = resolvedDetails.category === "SAST" ? resolvedDetails.details : null;
  const secretsDetails = resolvedDetails.category === "SECRETS" ? resolvedDetails.details : null;
  const iacDetails = resolvedDetails.category === "IAC" ? resolvedDetails.details : null;
  const containerDetails = resolvedDetails.category === "CONTAINER" ? resolvedDetails.details : null;
  const dastDetails = resolvedDetails.category === "DAST" ? resolvedDetails.details : null;
  const showScaTab = resolvedDetails.category === "SCA";
  const showSastTab = resolvedDetails.category === "SAST";
  const showSecretsTab = resolvedDetails.category === "SECRETS";
  const showIacTab = resolvedDetails.category === "IAC";
  const showContainerTab = resolvedDetails.category === "CONTAINER";
  const showDastTab = resolvedDetails.category === "DAST";
  const showBduTab = Boolean(intelDetails?.bdu && Object.keys(intelDetails.bdu).length > 0);
  const riskScore =
    typeof data.riskScore === "number" ? Math.round(data.riskScore) : null;
  const riskBand = data.riskBand ?? null;
  const riskFactors = data.riskFactors ?? null;
  const canShowFactors = Boolean(riskFactors);
  const primaryMetadata = [
    { label: "Severity", value: SEVERITY_STYLES[data.severity].label },
    { label: "Status", value: STATUS_LABELS[data.status] ?? data.status },
    { label: "Category", value: resolvedDetails.category || data.category },
    { label: "Product", value: data.productName || "—" },
    { label: "Scanner", value: data.scannerType || "—" },
    { label: "Source", value: data.sourceType || "—" },
    {
      label: "First seen",
      value: data.firstSeenAt ? formatDateRu(data.firstSeenAt) : "—",
    },
    {
      label: "Last seen",
      value: data.lastSeenAt ? formatDateRu(data.lastSeenAt) : "—",
    },
  ];

  let tabIndex = 0;
  const descriptionIndex = tabIndex++;
  const scaIndex = showScaTab ? tabIndex++ : null;
  const sastIndex = showSastTab ? tabIndex++ : null;
  const secretsIndex = showSecretsTab ? tabIndex++ : null;
  const iacIndex = showIacTab ? tabIndex++ : null;
  const containerIndex = showContainerTab ? tabIndex++ : null;
  const dastIndex = showDastTab ? tabIndex++ : null;
  const bduIndex = showBduTab ? tabIndex++ : null;
  const semgrepIndex = semgrepEvidence ? tabIndex++ : null;
  const occurrencesIndex = tabIndex++;
  const commentsIndex = tabIndex++;
  const historyIndex = tabIndex++;
  const duplicatesIndex = data.duplicates ? tabIndex++ : null;

  const slaDueAt = data.slaDueAt ? new Date(data.slaDueAt) : null;
  const slaDaysRemaining =
    typeof data.slaDaysRemaining === "number"
      ? data.slaDaysRemaining
      : slaDueAt
        ? Math.ceil((slaDueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
  const slaClosed = slaClosedStatuses.has(data.status);
  const slaBreached = Boolean(data.slaBreached) && !slaClosed;
  const slaStatusLabel = !slaDueAt
    ? "Not set"
    : slaBreached || (typeof slaDaysRemaining === "number" && slaDaysRemaining < 0)
      ? "BREACHED"
      : slaDaysRemaining === 0
        ? "Due today"
        : `${slaDaysRemaining}d left`;
  const slaStatusColor = !slaDueAt
    ? "text.secondary"
    : slaBreached || (typeof slaDaysRemaining === "number" && slaDaysRemaining < 0)
      ? "#ef5350"
      : slaDaysRemaining === 0
        ? "#ffb74d"
        : "#81c784";
  const slaStatusBg = !slaDueAt
    ? "transparent"
    : slaBreached || (typeof slaDaysRemaining === "number" && slaDaysRemaining < 0)
      ? "rgba(244, 67, 54, 0.12)"
      : slaDaysRemaining === 0
        ? "rgba(255, 152, 0, 0.15)"
        : "rgba(76, 175, 80, 0.12)";

  // Severity color from design system
  const severityColor = semantic.severity[data.severity]?.base ?? primitives.night[300];

  // Build minimal header chips - only severity badge
  const chips = [
    <Typography
      key="sev"
      component="span"
      variant="caption"
      sx={{
        fontWeight: 700,
        color: severityColor,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: alpha(severityColor, 0.12),
      }}
    >
      {SEVERITY_STYLES[data.severity].label}
    </Typography>,
    resolvedDetails.category ? (
      <Typography
        key="cat"
        component="span"
        variant="caption"
        sx={{
          color: primitives.night[400],
          fontSize: "0.7rem",
        }}
      >
        {resolvedDetails.category}
      </Typography>
    ) : null,
  ].filter(Boolean);
  // Subtle panel style - no borders, just gentle background
  const panelBoxSx = {
    p: 2,
    borderRadius: 1.5,
    bgcolor: alpha(primitives.night[700], 0.25),
  } as const;

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
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
            {chips}
          </Stack>
          <Typography variant={compact ? "h6" : "h5"} sx={{ lineHeight: 1.2, wordBreak: "break-word" }}>
            {data.title}
          </Typography>
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

      <Divider sx={{ my: 2, borderColor: primitives.night[600] }} />

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          borderBottom: "1px solid",
          borderColor: primitives.night[600],
          "& .MuiTabs-flexContainer": {
            justifyContent: "flex-start",
          },
          "& .MuiTabs-indicator": {
            backgroundColor: primitives.lotus[500],
            height: 2,
          },
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 500,
            minHeight: 42,
            color: primitives.night[400],
            fontSize: "0.8125rem",
          },
          "& .MuiTab-root.Mui-selected": {
            color: primitives.night[100],
            fontWeight: 600,
          },
          "& .MuiTab-root:hover": {
            color: primitives.night[200],
          },
        }}
      >
        <Tab label="Описание" />
        {showScaTab ? <Tab label="SCA" /> : null}
        {showSastTab ? <Tab label="SAST" /> : null}
        {showSecretsTab ? <Tab label="Secrets" /> : null}
        {showIacTab ? <Tab label="IaC" /> : null}
        {showContainerTab ? <Tab label="Container" /> : null}
        {showDastTab ? <Tab label="DAST" /> : null}
        {showBduTab ? <Tab label="БДУ ФСТЭК" /> : null}
        {semgrepEvidence ? <Tab label="Источник (Semgrep)" /> : null}
        <Tab label={`Occurrences${hasOccurrences ? ` (${occurrences.length})` : ""}`} />
        <Tab label={`Комментарии (${data.comments?.length ?? 0})`} />
        <Tab label={`История (${data.events?.length ?? 0})`} />
        {data.duplicates ? <Tab label="Дубликаты" /> : null}
      </Tabs>

      {/* Tab: Description */}
      <TabPanel value={tab} index={descriptionIndex}>
        {/* Quick Status Action - Most important for triage */}
        {canEdit && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: alpha(primitives.night[700], 0.4),
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="caption" sx={{ color: primitives.night[400], minWidth: 50 }}>
              Status
            </Typography>
            <TextField
              select
              value={statusManager.status}
              onChange={(event) => statusManager.setStatus(event.target.value as any)}
              size="small"
              sx={{
                minWidth: 150,
                "& .MuiOutlinedInput-root": {
                  bgcolor: primitives.night[700],
                },
              }}
            >
              {ALL_STATUSES.map((k) => (
                <MenuItem key={k} value={k}>
                  {STATUS_LABELS[k]}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              size="small"
              onClick={statusManager.handleStatusUpdate}
              disabled={statusManager.statusState === "saving" || !statusManager.statusChanged}
              sx={{
                bgcolor: primitives.lotus[500],
                "&:hover": { bgcolor: primitives.lotus[600] },
              }}
            >
              {statusManager.statusState === "saving" ? "..." : "Save"}
            </Button>
            {statusManager.statusState === "saved" && (
              <Typography variant="caption" sx={{ color: primitives.jade[400] }}>
                ✓ Saved
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Copy link">
              <IconButton
                size="small"
                onClick={() =>
                  handleCopyValue(
                    new URL(navigation.buildFindingLinkWithReturn(id), window.location.origin).toString()
                  )
                }
                sx={{ color: primitives.night[400] }}
              >
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Description text */}
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-line",
            color: primitives.night[200],
            lineHeight: 1.6,
          }}
        >
          {data.description || "Описание отсутствует."}
        </Typography>

        {/* Compact metadata - only essential info */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 1.5,
            mt: 2,
            py: 1.5,
            borderTop: "1px solid",
            borderColor: alpha(primitives.night[600], 0.5),
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Category
            </Typography>
            <Typography variant="body2" sx={{ color: primitives.night[200] }}>
              {resolvedDetails.category || data.category || "—"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Product
            </Typography>
            <Typography variant="body2" sx={{ color: primitives.night[200] }}>
              {data.productName || "—"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              First seen
            </Typography>
            <Typography variant="body2" sx={{ color: primitives.night[200] }}>
              {data.firstSeenAt ? formatDateRu(data.firstSeenAt) : "—"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Last seen
            </Typography>
            <Typography variant="body2" sx={{ color: primitives.night[200] }}>
              {data.lastSeenAt ? formatDateRu(data.lastSeenAt) : "—"}
            </Typography>
          </Box>
        </Box>

        {/* Collapsible Details - click to expand */}
        <Stack spacing={0} sx={{ mt: 2 }}>
          {/* Risk Score - compact header */}
          <Box
            onClick={() => setRiskExpanded(!riskExpanded)}
            sx={{
              py: 1,
              px: 1.5,
              cursor: "pointer",
              borderTop: "1px solid",
              borderColor: alpha(primitives.night[600], 0.3),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              "&:hover": { bgcolor: alpha(primitives.night[700], 0.3) },
            }}
          >
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Typography variant="caption" sx={{ color: primitives.night[400], fontSize: "0.7rem" }}>
                Risk
              </Typography>
              {riskScore !== null && riskBand ? (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: RISK_BAND_COLORS[riskBand], fontSize: "0.8125rem" }}
                >
                  {RISK_BAND_LABELS[riskBand]} {riskScore}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: primitives.night[500] }}>—</Typography>
              )}
              {cvssScore !== null && (
                <Typography variant="caption" sx={{ color: primitives.night[400] }}>
                  CVSS {cvssScore.toFixed(1)}
                </Typography>
              )}
              {kevFlag && (
                <Typography variant="caption" sx={{ color: semantic.severity.critical.base, fontWeight: 700 }}>
                  KEV
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: primitives.night[500] }}>
              {riskExpanded ? "−" : "+"}
            </Typography>
          </Box>
          <Collapse in={riskExpanded}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
              <Stack spacing={0.75}>
                {cvssScore !== null && (
                  <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                    CVSS{cvssVersion ? ` v${cvssVersion}` : ""}: {cvssScore.toFixed(1)}
                  </Typography>
                )}
                {epssScore !== null && (
                  <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                    EPSS: {(epssScore * 100).toFixed(2)}%
                    {epssPercentile !== null && ` (p${(epssPercentile * 100).toFixed(0)})`}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: primitives.night[400] }}>
                  Updated: {data.riskUpdatedAt ? formatDateRu(data.riskUpdatedAt) : "—"}
                </Typography>
              </Stack>
            </Box>
          </Collapse>

          {/* SLA - compact header */}
          <Box
            onClick={() => setSlaExpanded(!slaExpanded)}
            sx={{
              py: 1,
              px: 1.5,
              cursor: "pointer",
              borderTop: "1px solid",
              borderColor: alpha(primitives.night[600], 0.3),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              "&:hover": { bgcolor: alpha(primitives.night[700], 0.3) },
            }}
          >
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Typography variant="caption" sx={{ color: primitives.night[400], fontSize: "0.7rem" }}>
                SLA
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: slaStatusColor, fontSize: "0.8125rem" }}
              >
                {slaStatusLabel}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: primitives.night[500] }}>
              {slaExpanded ? "−" : "+"}
            </Typography>
          </Box>
          <Collapse in={slaExpanded}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
              <Stack spacing={0.75}>
                <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                  Due: {data.slaDueAt ? formatDateRu(data.slaDueAt) : "—"}
                </Typography>
                <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                  Days remaining: {typeof slaDaysRemaining === "number" ? slaDaysRemaining : "—"}
                </Typography>
              </Stack>
            </Box>
          </Collapse>
        </Stack>

        {/* Intelligence - compact collapsible */}
        {(intelIdentifiers.length > 0 || intelReferences.length > 0) && (
          <Box
            onClick={() => setIntelExpanded(!intelExpanded)}
            sx={{
              py: 1,
              px: 1.5,
              cursor: "pointer",
              borderTop: "1px solid",
              borderColor: alpha(primitives.night[600], 0.3),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              "&:hover": { bgcolor: alpha(primitives.night[700], 0.3) },
            }}
          >
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Typography variant="caption" sx={{ color: primitives.night[400], fontSize: "0.7rem" }}>
                Intel
              </Typography>
              {intelIdentifiers.length > 0 && (
                <Typography variant="caption" sx={{ color: primitives.night[300], fontFamily: "monospace" }}>
                  {intelIdentifiers[0]}{intelIdentifiers.length > 1 && ` +${intelIdentifiers.length - 1}`}
                </Typography>
              )}
              {showBduTab && bduIndex !== null && (
                <Typography
                  variant="caption"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTab(bduIndex);
                  }}
                  sx={{ color: primitives.lotus[400], textDecoration: "underline", cursor: "pointer" }}
                >
                  Открыть БДУ
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: primitives.night[500] }}>
              {intelExpanded ? "−" : "+"}
            </Typography>
          </Box>
        )}
        {(intelIdentifiers.length > 0 || intelReferences.length > 0) && (
          <Collapse in={intelExpanded}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
              {intelIdentifiers.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                  {intelIdentifiers.map((identifier) => (
                    <Typography
                      key={identifier}
                      variant="caption"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyValue(identifier);
                      }}
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        bgcolor: alpha(primitives.night[600], 0.3),
                        color: primitives.night[300],
                        cursor: "pointer",
                        fontFamily: "monospace",
                        fontSize: "0.7rem",
                        "&:hover": { color: primitives.night[100] },
                      }}
                    >
                      {identifier}
                    </Typography>
                  ))}
                </Stack>
              )}
              {intelReferences.length > 0 && (
                <Stack spacing={0.25}>
                  {intelReferences.slice(0, 5).map((ref) => (
                    <MuiLink
                      key={ref.url}
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        fontSize: "0.75rem",
                        color: primitives.night[300],
                        textDecoration: "none",
                        "&:hover": { color: primitives.lotus[400] },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {ref.title || ref.url}
                    </MuiLink>
                  ))}
                  {intelReferences.length > 5 && (
                    <Typography variant="caption" sx={{ color: primitives.night[500] }}>
                      +{intelReferences.length - 5} more references
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          </Collapse>
        )}

      </TabPanel>

      {/* Tab: SCA */}
      {showScaTab && scaIndex !== null && (
        <TabPanel value={tab} index={scaIndex}>
          <Section title="SCA" dense={compact}>
            {scaDetails ? (
              <Stack spacing={1.2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Package
                  </Typography>
                  <Typography variant="body2">{scaDetails.pkgName}</Typography>
                  {scaDetails.purl && (
                    <Tooltip title="Скопировать PURL">
                      <IconButton size="small" onClick={() => handleCopyValue(scaDetails.purl ?? "")}>
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Installed version
                  </Typography>
                  <Typography variant="body2">{scaDetails.installedVersion}</Typography>
                </Stack>
                <Stack direction="row" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Fixed version
                  </Typography>
                  <Typography variant="body2">{scaDetails.fixedVersion || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Vulnerability ID
                  </Typography>
                  <Typography variant="body2">{scaDetails.vulnerabilityId}</Typography>
                  <Tooltip title="Скопировать">
                    <IconButton
                      size="small"
                      onClick={() => handleCopyValue(scaDetails.vulnerabilityId)}
                    >
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Primary URL
                  </Typography>
                  {scaDetails.primaryUrl ? (
                    <MuiLink href={scaDetails.primaryUrl} target="_blank" rel="noreferrer">
                      {scaDetails.primaryUrl}
                    </MuiLink>
                  ) : (
                    <Typography variant="body2">—</Typography>
                  )}
                </Stack>
                {scaDetails.references && scaDetails.references.length > 0 && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      References
                    </Typography>
                    <Stack spacing={0.5}>
                      {scaDetails.references.map((ref) => (
                        <Stack key={ref} direction="row" alignItems="center" spacing={1}>
                          <MuiLink href={ref} target="_blank" rel="noreferrer">
                            {ref}
                          </MuiLink>
                          <IconButton size="small" onClick={() => handleCopyValue(ref)}>
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Alert severity="warning">SCA details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {/* Tab: SAST */}
      {showSastTab && sastIndex !== null && (
        <TabPanel value={tab} index={sastIndex}>
          <Section title="SAST" dense={compact}>
            {sastDetails ? (
              <Stack spacing={1.2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Rule
                  </Typography>
                  <Typography variant="body2">{sastDetails.ruleId || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    File
                  </Typography>
                  <Typography variant="body2">{sastDetails.filePath || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Range
                  </Typography>
                  <Typography variant="body2">
                    {sastDetails.startLine && sastDetails.endLine
                      ? `${sastDetails.startLine}–${sastDetails.endLine}`
                      : "—"}
                  </Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Snippet
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {sastDetails.snippet || "—"}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Alert severity="warning">SAST details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {/* Tab: Secrets */}
      {showSecretsTab && secretsIndex !== null && (
        <TabPanel value={tab} index={secretsIndex}>
          <Section title="Secrets" dense={compact}>
            {secretsDetails ? (
              <Stack spacing={1.2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Secret Type
                  </Typography>
                  <Typography variant="body2">{secretsDetails.ruleId || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    File
                  </Typography>
                  <Typography variant="body2">{secretsDetails.filePath || "—"}</Typography>
                </Stack>
                {secretsDetails.message && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Message
                    </Typography>
                    <Typography variant="body2">{secretsDetails.message}</Typography>
                  </Stack>
                )}
                {secretsDetails.snippet && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Snippet (redacted)
                    </Typography>
                    <CodeBlock
                      code={secretsDetails.snippet}
                      language={secretsDetails.filePath?.split('.').pop() || undefined}
                      filename={secretsDetails.filePath || undefined}
                    />
                  </Stack>
                )}
              </Stack>
            ) : (
              <Alert severity="warning">Secrets details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {/* Tab: IaC */}
      {showIacTab && iacIndex !== null && (
        <TabPanel value={tab} index={iacIndex}>
          <Section title="Infrastructure as Code" dense={compact}>
            {iacDetails ? (
              <Stack spacing={1.2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Rule / Check
                  </Typography>
                  <Typography variant="body2">{iacDetails.ruleId || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    File
                  </Typography>
                  <Typography variant="body2">{iacDetails.filePath || "—"}</Typography>
                </Stack>
                {(iacDetails.startLine || iacDetails.endLine) && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Lines
                    </Typography>
                    <Typography variant="body2">
                      {iacDetails.startLine && iacDetails.endLine
                        ? `${iacDetails.startLine}–${iacDetails.endLine}`
                        : iacDetails.startLine || iacDetails.endLine || "—"}
                    </Typography>
                  </Stack>
                )}
                {iacDetails.resource && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Resource
                    </Typography>
                    <Typography variant="body2">{iacDetails.resource}</Typography>
                  </Stack>
                )}
                {iacDetails.checkType && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Check Type
                    </Typography>
                    <Typography variant="body2">{iacDetails.checkType}</Typography>
                  </Stack>
                )}
                {iacDetails.framework && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Framework
                    </Typography>
                    <Typography variant="body2">{iacDetails.framework}</Typography>
                  </Stack>
                )}
                {iacDetails.message && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Message
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {iacDetails.message}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Alert severity="warning">IaC details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {/* Tab: Container */}
      {showContainerTab && containerIndex !== null && (
        <TabPanel value={tab} index={containerIndex}>
          <Section title="Container Vulnerability" dense={compact}>
            {containerDetails ? (
              <Stack spacing={1.2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Package
                  </Typography>
                  <Typography variant="body2">{containerDetails.pkgName || "—"}</Typography>
                  {containerDetails.purl && (
                    <Tooltip title="Скопировать PURL">
                      <IconButton size="small" onClick={() => handleCopyValue(containerDetails.purl ?? "")}>
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Installed version
                  </Typography>
                  <Typography variant="body2">{containerDetails.installedVersion || "—"}</Typography>
                </Stack>
                <Stack direction="row" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Fixed version
                  </Typography>
                  <Typography variant="body2">{containerDetails.fixedVersion || "—"}</Typography>
                </Stack>
                {containerDetails.fixState && (
                  <Stack direction="row" gap={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Fix state
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: containerDetails.fixState === "fixed"
                          ? semantic.severity.low.base
                          : primitives.night[300],
                      }}
                    >
                      {containerDetails.fixState}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Vulnerability ID
                  </Typography>
                  <Typography variant="body2">{containerDetails.vulnerabilityId || "—"}</Typography>
                  {containerDetails.vulnerabilityId && (
                    <Tooltip title="Скопировать">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyValue(containerDetails.vulnerabilityId ?? "")}
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                {containerDetails.imageRef && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Image
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                      {containerDetails.imageRef}
                    </Typography>
                  </Stack>
                )}
                {containerDetails.ecosystem && (
                  <Stack direction="row" gap={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Ecosystem
                    </Typography>
                    <Typography variant="body2">{containerDetails.ecosystem}</Typography>
                  </Stack>
                )}
                <Stack direction="row" gap={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                    Primary URL
                  </Typography>
                  {containerDetails.primaryUrl ? (
                    <MuiLink href={containerDetails.primaryUrl} target="_blank" rel="noreferrer">
                      {containerDetails.primaryUrl}
                    </MuiLink>
                  ) : (
                    <Typography variant="body2">—</Typography>
                  )}
                </Stack>
                {containerDetails.references && containerDetails.references.length > 0 && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      References
                    </Typography>
                    <Stack spacing={0.5}>
                      {containerDetails.references.map((ref) => (
                        <Stack key={ref} direction="row" alignItems="center" spacing={1}>
                          <MuiLink href={ref} target="_blank" rel="noreferrer">
                            {ref}
                          </MuiLink>
                          <IconButton size="small" onClick={() => handleCopyValue(ref)}>
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Alert severity="warning">Container details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {/* Tab: DAST */}
      {showDastTab && dastIndex !== null && (
        <TabPanel value={tab} index={dastIndex}>
          <Section title="DAST" dense={compact}>
            {dastDetails ? (
              <Stack spacing={1.2}>
                {dastDetails.ruleId && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Rule / Template
                    </Typography>
                    <Typography variant="body2">{dastDetails.ruleId}</Typography>
                  </Stack>
                )}
                {dastDetails.templateId && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Template ID
                    </Typography>
                    <Typography variant="body2">{dastDetails.templateId}</Typography>
                  </Stack>
                )}
                {dastDetails.url && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      URL
                    </Typography>
                    <MuiLink href={dastDetails.url} target="_blank" rel="noreferrer" sx={{ wordBreak: "break-all" }}>
                      {dastDetails.url}
                    </MuiLink>
                  </Stack>
                )}
                {dastDetails.method && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Method
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: primitives.night[200],
                      }}
                    >
                      {dastDetails.method}
                    </Typography>
                  </Stack>
                )}
                {dastDetails.parameter && (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
                      Parameter
                    </Typography>
                    <Typography variant="body2">{dastDetails.parameter}</Typography>
                  </Stack>
                )}
                {dastDetails.message && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Message
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {dastDetails.message}
                    </Typography>
                  </Stack>
                )}
                {dastDetails.evidence && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Evidence
                    </Typography>
                    <CodeBlock code={dastDetails.evidence} language="text" />
                  </Stack>
                )}
              </Stack>
            ) : (
              <Alert severity="warning">DAST details недоступны для этой находки.</Alert>
            )}
          </Section>
        </TabPanel>
      )}

      {resolvedDetails.category === "UNKNOWN" && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Unsupported/Unknown category для отображения деталей.
        </Alert>
      )}

      {/* Tab: Semgrep Evidence */}
      {showBduTab && bduIndex !== null && intelDetails?.bdu && (
        <TabPanel value={tab} index={bduIndex}>
          <Section title="БДУ ФСТЭК" dense={compact}>
            <BduPanel bdu={intelDetails.bdu} />
          </Section>
        </TabPanel>
      )}

      {semgrepEvidence && semgrepIndex !== null && (
        <TabPanel value={tab} index={semgrepIndex}>
          <Section title="Источник (Semgrep)" dense={compact}>
            <Box sx={panelBoxSx}>
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
                    ? `:${semgrepEvidence.start.line}${semgrepEvidence.start.col ? `:${semgrepEvidence.start.col}` : ""
                    }`
                    : ""}
                  {semgrepEvidence.end?.line
                    ? ` → ${semgrepEvidence.end.line}${semgrepEvidence.end.col ? `:${semgrepEvidence.end.col}` : ""
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
                  highlightLines={(() => {
                    const startLine = semgrepEvidence.start?.line;
                    const endLine = semgrepEvidence.end?.line;
                    if (startLine && endLine) {
                      return Array.from(
                        { length: endLine - startLine + 1 },
                        (_, i) => startLine + i
                      );
                    }
                    return undefined;
                  })()}
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
            </Box>
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
      <TabPanel value={tab} index={occurrencesIndex}>
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
      <TabPanel value={tab} index={commentsIndex}>
        <Section title="Комментарии" dense={compact}>
          <Stack spacing={2}>
            <Box sx={panelBoxSx}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
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
              {commentsManager.commentError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {commentsManager.commentError}
                </Alert>
              )}
            </Box>

            <Box sx={panelBoxSx}>
              {(data.comments ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Комментариев пока нет.
                </Typography>
              ) : (
                <Stack spacing={1.2}>
                  {(data.comments ?? []).map((c: FindingComment) => (
                    <Box
                      key={c.id}
                      sx={{
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: alpha(primitives.night[600], 0.5),
                        "&:last-child": { borderBottom: "none" },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: primitives.night[400], fontSize: "0.7rem" }}
                      >
                        {c.author || "Пользователь"} · {formatDateRu(c.createdAt)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, whiteSpace: "pre-line", color: primitives.night[200] }}
                      >
                        {c.body}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </Section>
      </TabPanel>

      {/* Tab: Events History */}
      <TabPanel value={tab} index={historyIndex}>
        <Section title="История изменений" dense={compact}>
          <Box sx={panelBoxSx}>
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
          </Box>
        </Section>
      </TabPanel>

      {/* Tab: Duplicates */}
      {data.duplicates && duplicatesIndex !== null && (
        <TabPanel value={tab} index={duplicatesIndex}>
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

type FindingDetailErrorBoundaryProps = {
  children: ReactNode;
};

type FindingDetailErrorBoundaryState = {
  error: Error | null;
};

export class FindingDetailErrorBoundary extends Component<
  FindingDetailErrorBoundaryProps,
  FindingDetailErrorBoundaryState
> {
  state: FindingDetailErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): FindingDetailErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FindingDetail] render error", error);
    console.error("[FindingDetail] component stack", info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <Alert severity="error">
          Не удалось отобразить детали находки.
          {error.message ? ` Причина: ${error.message}` : " Проверьте консоль для деталей."}
        </Alert>
      );
    }
    return this.props.children;
  }
}

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    console.log("FindingDetailPage mounted", id);
  }, [id]);

  if (!id) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Некорректный ID</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <FindingDetailErrorBoundary>
        <FindingDetailContent id={id} compact={false} />
      </FindingDetailErrorBoundary>
    </Container>
  );
};

export default FindingDetailPage;
