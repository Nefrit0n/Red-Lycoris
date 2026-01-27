import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScheduleIcon from "@mui/icons-material/Schedule";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import RadarIcon from "@mui/icons-material/Radar";
import SecurityIcon from "@mui/icons-material/Security";
import { ReactNode, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FindingListItemDTO,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  RiskBand,
} from "../types/findings";
import { RISK_BAND_COLORS } from "../utils/findingConstants";
import {
  tableColumnWidths,
  tableStyles,
  slaStyles,
} from "../design-system/utils";
import { semantic, primitives, alpha } from "../design-system/tokens/colors";

/**
 * Ширины колонок.
 * Issue details занимает всё оставшееся место.
 */
const COL_CHECKBOX = tableColumnWidths.checkbox;
const COL_SEVERITY = tableColumnWidths.severity;
const COL_RISK = tableColumnWidths.risk;
const COL_STATUS = tableColumnWidths.status;
const COL_SLA = tableColumnWidths.sla;
const COL_ACTIONS = tableColumnWidths.actions;

const severityLabels: Record<FindingSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const riskBandShortLabels: Record<RiskBand, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

// Severity configuration using design system - COMPACT (no icons)
const severityConfig: Record<FindingSeverity, {
  bgcolor: string;
  color: string;
  borderColor?: string;
}> = {
  critical: {
    bgcolor: semantic.severity.critical.base,
    color: primitives.white,
  },
  high: {
    bgcolor: semantic.severity.high.base,
    color: primitives.white,
  },
  medium: {
    bgcolor: semantic.severity.medium.subtle,
    color: semantic.severity.medium.text,
    borderColor: `rgba(234, 88, 12, 0.4)`,
  },
  low: {
    bgcolor: semantic.severity.low.subtle,
    color: semantic.severity.low.text,
    borderColor: `rgba(22, 163, 74, 0.3)`,
  },
};

// Border colors using design system
const severityBorderColors: Record<FindingSeverity, string> = {
  low: semantic.severity.low.base,
  medium: semantic.severity.medium.base,
  high: semantic.severity.high.base,
  critical: semantic.severity.critical.base,
};

// Row backgrounds using design system
const severityRowBgColors: Record<FindingSeverity, string | null> = {
  critical: semantic.severity.high.subtle,
  high: `rgba(244, 67, 54, 0.04)`,
  medium: null,
  low: null,
};

// Policy decision styles using design system
const policyDecisionStyles: Record<string, { label: string; color: string; border: string }> = {
  pass: { label: "PASS", color: semantic.severity.low.text, border: "rgba(129, 199, 132, 0.45)" },
  warn: { label: "WARN", color: semantic.severity.medium.text, border: "rgba(255, 183, 77, 0.45)" },
  fail: { label: "FAIL", color: semantic.severity.high.light, border: "rgba(239, 83, 80, 0.5)" },
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

// Status configuration using design system - COMPACT (no icons)
const statusConfig: Record<FindingStatus, {
  bgcolor: string;
  color: string;
  borderColor?: string;
}> = {
  new: {
    bgcolor: semantic.status.new.subtle,
    color: semantic.status.new.text,
    borderColor: `rgba(59, 130, 246, 0.4)`,
  },
  under_review: {
    bgcolor: semantic.status.inProgress.subtle,
    color: semantic.status.inProgress.text,
    borderColor: `rgba(245, 158, 11, 0.35)`,
  },
  confirmed: {
    bgcolor: semantic.feedback.error.subtle,
    color: semantic.feedback.error.light,
    borderColor: `rgba(244, 67, 54, 0.35)`,
  },
  mitigated: {
    bgcolor: semantic.status.resolved.subtle,
    color: semantic.status.resolved.text,
    borderColor: `rgba(16, 185, 129, 0.35)`,
  },
  false_positive: {
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.25)`,
  },
  out_of_scope: {
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.25)`,
  },
  risk_accepted: {
    bgcolor: semantic.feedback.warning.subtle,
    color: primitives.gold[300],
    borderColor: `rgba(255, 193, 7, 0.25)`,
  },
  duplicate: {
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.25)`,
  },
};

const slaClosedStatuses = new Set<FindingStatus>([
  "mitigated",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "duplicate",
]);

// Примечание: occurrenceLabels и occurrenceColors удалены,
// т.к. repeat/age badges теперь используют кастомную стилизацию

interface FindingsTableProps {
  data: FindingListItemDTO[];
  selectedIds: string[];
  sortField: keyof FindingListItemDTO;
  sortOrder: "asc" | "desc";
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onSortChange: (field: keyof FindingListItemDTO) => void;
  loading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onResetFilters: () => void;
  batchMode: boolean;
  highlightQuery: string;
  rowCount: number;

  /** путь списка (для открытия полной страницы детали) */
  returnTo: string;

  /** сохранить scroll / состояние списка */
  onNavigateToDetail: () => void;

  /** открыть Drawer справа */
  onOpenDetails: (id: string) => void;

  /** id находки, которая сейчас открыта в Drawer (для подсветки строки) */
  activeFindingId?: string | null;

  /** компактный режим отображения (без метаданных) */
  compactMode?: boolean;

  /** включить группировку по rule title */
  groupByRule?: boolean;
}

// Интерфейс для группы findings
interface FindingGroup {
  title: string;
  shortTitle: string;
  findings: FindingListItemDTO[];
  highestSeverity: FindingSeverity;
  statuses: Set<FindingStatus>;
}

// Функция для группировки findings по title
const groupFindingsByTitle = (findings: FindingListItemDTO[]): FindingGroup[] => {
  const groups = new Map<string, FindingListItemDTO[]>();

  findings.forEach(f => {
    const key = f.title;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(f);
  });

  const severityOrder: Record<FindingSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return Array.from(groups.entries()).map(([title, groupFindings]) => {
    const { display: shortTitle } = formatSmartTitle(title);

    // Находим наивысший severity в группе
    const highestSeverity = groupFindings.reduce((max, f) => {
      return severityOrder[f.severity] > severityOrder[max] ? f.severity : max;
    }, groupFindings[0].severity);

    // Собираем все статусы
    const statuses = new Set(groupFindings.map(f => f.status));

    return {
      title,
      shortTitle,
      findings: groupFindings,
      highestSeverity,
      statuses,
    };
  });
};

const formatDateTimeRuCompact = (value?: string | null) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return dt.toLocaleString("ru-RU");
  }
};

const resolveSlaDisplay = (finding: FindingListItemDTO, now: Date) => {
  if (!finding.slaDueAt) {
    return {
      label: slaStyles.none.label,
      color: slaStyles.none.color,
      bgcolor: slaStyles.none.bgcolor,
      borderColor: slaStyles.none.borderColor,
      dueAtLabel: "",
    };
  }

  const dueAt = new Date(finding.slaDueAt);
  const daysRemaining =
    typeof finding.slaDaysRemaining === "number"
      ? finding.slaDaysRemaining
      : Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isClosed = slaClosedStatuses.has(finding.status);
  const isBreached = Boolean(finding.slaBreached) && !isClosed;

  if (isBreached || daysRemaining < 0) {
    return {
      label: slaStyles.breached.label,
      color: slaStyles.breached.color,
      bgcolor: slaStyles.breached.bgcolor,
      borderColor: slaStyles.breached.borderColor,
      dueAtLabel: formatDateTimeRuCompact(finding.slaDueAt),
    };
  }

  if (daysRemaining === 0) {
    return {
      label: slaStyles.dueToday.label,
      color: slaStyles.dueToday.color,
      bgcolor: slaStyles.dueToday.bgcolor,
      borderColor: slaStyles.dueToday.borderColor,
      dueAtLabel: formatDateTimeRuCompact(finding.slaDueAt),
    };
  }

  return {
    label: `${daysRemaining}d left`,
    color: slaStyles.onTrack.color,
    bgcolor: slaStyles.onTrack.bgcolor,
    borderColor: slaStyles.onTrack.borderColor,
    dueAtLabel: formatDateTimeRuCompact(finding.slaDueAt),
  };
};

const prettifyScanner = (v?: string | null) => {
  if (!v) return "—";
  const s = v.trim();
  if (!s) return "—";
  return s.length <= 4 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1);
};

// Вычисление возраста находки в днях
const getAgeDays = (dateStr?: string | null): number => {
  if (!dateStr) return 0;
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const getAgeLabel = (days: number): string => {
  if (days < 7) return `${days}д`;
  if (days < 30) return `${Math.floor(days / 7)}н`;
  if (days < 365) return `${Math.floor(days / 30)}мес`;
  return `${Math.floor(days / 365)}г`;
};

/**
 * Smart title formatting для длинных rule names.
 * Примеры:
 * - "java.lang.security.audit.cbc-padding-oracle.cbc-padding-oracle" -> "cbc-padding-oracle"
 * - "Asymmetric Private Key" -> "Asymmetric Private Key" (без изменений)
 * - "semgrep.java.spring.xxe...." -> "xxe..." (последняя значимая часть)
 */
const formatSmartTitle = (title: string): { display: string; isShortened: boolean } => {
  if (!title) return { display: title, isShortened: false };

  // Если title содержит точки (namespace-style), извлекаем последнюю значимую часть
  if (title.includes(".") && title.length > 50) {
    const parts = title.split(".");

    // Находим последнюю уникальную часть (не дублирующуюся)
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts.length > 1 ? parts[parts.length - 2] : null;

    // Если последние две части одинаковые, берём одну
    if (secondLastPart && lastPart === secondLastPart) {
      return { display: lastPart, isShortened: true };
    }

    // Берём последние 2-3 значимые части
    const significantParts = parts.filter(p => p.length > 2).slice(-2);
    if (significantParts.length > 0) {
      return { display: significantParts.join("."), isShortened: true };
    }
  }

  return { display: title, isShortened: false };
};

const buildFindingLink = (id: string, returnTo: string) => {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const qs = params.toString();
  return `/findings/${id}${qs ? `?${qs}` : ""}`;
};

export default function FindingsTable({
  data,
  selectedIds,
  sortField,
  sortOrder,
  onToggleAll,
  onToggleOne,
  onSortChange,
  loading,
  errorMessage,
  onRetry,
  onResetFilters,
  batchMode,
  highlightQuery,
  rowCount,
  returnTo,
  onNavigateToDetail,
  onOpenDetails,
  activeFindingId,
  compactMode = false,
  groupByRule = false,
}: FindingsTableProps) {
  const safeData = Array.isArray(data) ? data : [];
  const now = useMemo(() => new Date(), [safeData]);

  // Состояние для развёрнутых групп (по title)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Группировка данных если включена
  const groupedData = useMemo(() => {
    if (!groupByRule || safeData.length === 0) return null;
    return groupFindingsByTitle(safeData);
  }, [groupByRule, safeData]);

  const toggleGroup = useCallback((title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const expandAllGroups = useCallback(() => {
    if (groupedData) {
      setExpandedGroups(new Set(groupedData.map(g => g.title)));
    }
  }, [groupedData]);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    safeData.length > 0 && safeData.every((finding) => selectedIdSet.has(finding.id));
  const someSelected =
    safeData.some((finding) => selectedIdSet.has(finding.id)) && !allSelected;

  const dtf = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "—";
    return dtf ? dtf.format(dt) : formatDateTimeRuCompact(value);
  };

  const normalizedQuery = highlightQuery.trim();
  const renderHighlightedTitle = useCallback(
    (title: string) => {
      const query = normalizedQuery;
      if (!query) return title;

      const lowerTitle = title.toLowerCase();
      const lowerQuery = query.toLowerCase();

      const parts: ReactNode[] = [];
      let startIndex = 0;
      let matchIndex = lowerTitle.indexOf(lowerQuery);

      while (matchIndex !== -1) {
        if (matchIndex > startIndex) parts.push(title.slice(startIndex, matchIndex));
        parts.push(
          <Box
            key={`${title}-${matchIndex}-${startIndex}`}
            component="span"
            sx={{
              backgroundColor: "rgba(255, 193, 7, 0.22)",
              fontWeight: 700,
              px: 0.5,
              borderRadius: 0.75,
            }}
          >
            {title.slice(matchIndex, matchIndex + lowerQuery.length)}
          </Box>
        );
        startIndex = matchIndex + lowerQuery.length;
        matchIndex = lowerTitle.indexOf(lowerQuery, startIndex);
      }

      if (startIndex < title.length) parts.push(title.slice(startIndex));
      return parts;
    },
    [normalizedQuery]
  );

  const colCount = 7; // checkbox + issue + severity + risk + status + sla + actions

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        overflowX: "auto",
        "& .MuiTableCell-head": { fontWeight: 700, whiteSpace: "nowrap" },
      }}
    >
      <Table
        stickyHeader
        size="small"
        sx={{
          width: "100%",
          minWidth: 900,
          tableLayout: "fixed",
        }}
      >
        {/* ВАЖНО: colgroup должен быть первым ребёнком table */}
        <colgroup>
          <col style={{ width: COL_CHECKBOX }} />
          <col /> {/* issue details (auto) */}
          <col style={{ width: COL_SEVERITY }} />
          <col style={{ width: COL_RISK }} />
          <col style={{ width: COL_STATUS }} />
          <col style={{ width: COL_SLA }} />
          <col style={{ width: COL_ACTIONS }} />
        </colgroup>

        <TableHead>
          <TableRow>
            <TableCell
              padding="checkbox"
              sx={{ width: COL_CHECKBOX, maxWidth: COL_CHECKBOX }}
            >
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                disabled={loading || Boolean(errorMessage) || safeData.length === 0}
                inputProps={{ "aria-label": "Выбрать все" }}
                onClick={(e) => e.stopPropagation()}
              />
            </TableCell>

            <TableCell sx={{ minWidth: 360 }}>
              <TableSortLabel
                hideSortIcon={false}
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder : "asc"}
                onClick={() => onSortChange("title")}
              >
                Issue details
              </TableSortLabel>
            </TableCell>

            <TableCell
              align="center"
              sx={{ width: COL_SEVERITY, maxWidth: COL_SEVERITY }}
            >
              <TableSortLabel
                hideSortIcon={false}
                active={sortField === "severity"}
                direction={sortField === "severity" ? sortOrder : "asc"}
                onClick={() => onSortChange("severity")}
              >
                Severity
              </TableSortLabel>
            </TableCell>

            <TableCell
              align="center"
              sx={{ width: COL_RISK, maxWidth: COL_RISK }}
            >
              <TableSortLabel
                hideSortIcon={false}
                active={sortField === "riskScore"}
                direction={sortField === "riskScore" ? sortOrder : "asc"}
                onClick={() => onSortChange("riskScore")}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <span>Risk</span>
                  <Tooltip title="Risk = Likelihood × Impact (OWASP)">
                    <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                  </Tooltip>
                </Stack>
              </TableSortLabel>
            </TableCell>

            <TableCell
              align="center"
              sx={{ width: COL_STATUS, maxWidth: COL_STATUS }}
            >
              <TableSortLabel
                hideSortIcon={false}
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder : "asc"}
                onClick={() => onSortChange("status")}
              >
                Status
              </TableSortLabel>
            </TableCell>

            <TableCell
              align="center"
              sx={{ width: COL_SLA, maxWidth: COL_SLA }}
            >
              <TableSortLabel
                hideSortIcon={false}
                active={sortField === "slaDueAt"}
                direction={sortField === "slaDueAt" ? sortOrder : "asc"}
                onClick={() => onSortChange("slaDueAt")}
              >
                SLA
              </TableSortLabel>
            </TableCell>

            <TableCell
              align="right"
              sx={{ width: COL_ACTIONS, maxWidth: COL_ACTIONS }}
            />
          </TableRow>
        </TableHead>

        <TableBody>
          {loading &&
            Array.from({ length: Math.max(rowCount, 8) }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell padding="checkbox" sx={{ width: COL_CHECKBOX }}>
                  <Skeleton variant="rectangular" width={18} height={18} />
                </TableCell>
                <TableCell>
                  <Skeleton width="70%" />
                  {!compactMode && <Skeleton width="45%" />}
                </TableCell>
                <TableCell align="center" sx={{ width: COL_SEVERITY }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell align="center" sx={{ width: COL_RISK }}>
                  <Skeleton width={70} />
                </TableCell>
                <TableCell align="center" sx={{ width: COL_STATUS }}>
                  <Skeleton width={110} />
                </TableCell>
                <TableCell align="center" sx={{ width: COL_SLA }}>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell align="right" sx={{ width: COL_ACTIONS }}>
                  <Skeleton width={28} height={28} />
                </TableCell>
              </TableRow>
            ))}

          {!loading && errorMessage && (
            <TableRow>
              <TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary" gutterBottom>
                  {errorMessage}
                </Typography>
                <IconButton color="primary" aria-label="Повторить" onClick={onRetry}>
                  <RefreshIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          )}

          {!loading && !errorMessage && safeData.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} align="center" sx={{ py: 8 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  {/* Иконка с анимацией */}
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      bgcolor: "rgba(76, 175, 80, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "emptyPulse 2s ease-in-out infinite",
                      "@keyframes emptyPulse": {
                        "0%, 100%": {
                          transform: "scale(1)",
                          boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.2)",
                        },
                        "50%": {
                          transform: "scale(1.05)",
                          boxShadow: "0 0 0 10px rgba(76, 175, 80, 0)",
                        },
                      },
                    }}
                  >
                    <SecurityIcon
                      sx={{
                        fontSize: 40,
                        color: "success.main",
                      }}
                    />
                  </Box>

                  {/* Текст */}
                  <Box sx={{ textAlign: "center" }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}
                    >
                      No findings match your filters
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", maxWidth: 320 }}
                    >
                      Try adjusting your search criteria or clear filters to see all findings
                    </Typography>
                  </Box>

                  {/* Кнопка */}
                  <Box
                    onClick={onResetFilters}
                    sx={{
                      mt: 1,
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: "primary.dark",
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    Clear all filters
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            !errorMessage &&
            safeData.map((f) => {
              const isSelected = selectedIdSet.has(f.id);
              const isActive = Boolean(activeFindingId) && activeFindingId === f.id;
              const occurrence = (f.occurrenceStatus ?? "NEW") as FindingOccurrenceStatus;
              const repeats = f.repeatCount ?? 0;
              const lastSeenAt = f.lastSeenAt || f.updatedAt;
              const ageDays = getAgeDays(f.firstSeenAt || f.createdAt);
              const showAgeWarning = ageDays >= 30;
              const primaryLabel = f.title;
              const ruleId: string | null = null;
              const shouldShowRule = false;
              const message: string | null = null;
              const intelSummary = f.intel_summary;
              const cvssScore =
                typeof intelSummary?.cvss?.score === "number"
                  ? intelSummary?.cvss?.score
                  : null;
              const cvssVersion = intelSummary?.cvss?.version ?? null;
              const epssScore =
                typeof intelSummary?.epss?.score === "number"
                  ? intelSummary?.epss?.score
                  : null;
              const epssPercentile =
                typeof intelSummary?.epss?.percentile === "number"
                  ? intelSummary?.epss?.percentile
                  : null;
              const isKev = Boolean(intelSummary?.kev);
              const isSca = f.category === "SCA";
              const isSast = f.category === "SAST";
              const isSecrets = f.category === "SECRETS";
              const isConfig = f.category === "CONFIG";

              // SAST-specific: Parse CWE/OWASP - extract just IDs from full strings
              // "CWE-79: Improper Neutralization..." → { id: "CWE-79", full: "..." }
              const parseCweOwasp = (items: string[] | null | undefined, maxShow: number) => {
                if (!items?.length) return { display: [], extra: 0, all: [] };
                const parsed = items.map((item) => {
                  // Extract ID: "CWE-79: Description" → "CWE-79" or "A07:2017 - Desc" → "A07:2017"
                  const match = item.match(/^(CWE-\d+|A\d{2}:\d{4})/i);
                  return { id: match ? match[1].toUpperCase() : item.split(/[:\-]/)[0].trim(), full: item };
                });
                return {
                  display: parsed.slice(0, maxShow),
                  extra: Math.max(0, parsed.length - maxShow),
                  all: parsed,
                };
              };

              const cweData = isSast ? parseCweOwasp(f.cwe, 2) : { display: [], extra: 0, all: [] };
              const owaspData = isSast ? parseCweOwasp(f.owasp, 1) : { display: [], extra: 0, all: [] };

              const slaDisplay = resolveSlaDisplay(f, now);
              const policyDecisionKey = f.policyDecision ? f.policyDecision.toLowerCase() : null;
              const policyDecisionMeta =
                policyDecisionKey && policyDecisionStyles[policyDecisionKey]
                  ? policyDecisionStyles[policyDecisionKey]
                  : null;

              const handleRowClick = () => {
                if (batchMode) onToggleOne(f.id);
                else onOpenDetails(f.id);
              };

              const rowBgColor = severityRowBgColors[f.severity];

              return (
                <TableRow
                  key={f.id}
                  hover
                  selected={isSelected}
                  onClick={handleRowClick}
                  role="button"
                  aria-selected={isSelected}
                  aria-current={isActive ? "true" : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRowClick();
                    }
                  }}
                  sx={{
                    cursor: "pointer",
                    "& td": { verticalAlign: "middle" },

                    // Zebra striping - чередование фона
                    "&:nth-of-type(even)": {
                      bgcolor: rowBgColor || "rgba(255, 255, 255, 0.015)",
                    },
                    "&:nth-of-type(odd)": {
                      bgcolor: rowBgColor || "transparent",
                    },

                    // Border между строками
                    borderBottom: "1px solid",
                    borderColor: "rgba(255, 255, 255, 0.06)",

                    // Улучшенный hover эффект
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "rgba(122, 162, 247, 0.08) !important",
                      "& .finding-rowStripe": { width: 5, opacity: 1 },
                    },

                    // Active state (открыт в drawer)
                    ...(isActive && !isSelected
                      ? {
                        bgcolor: "action.selected",
                        "&:hover": { bgcolor: "action.selected" },
                        "& .finding-rowStripe": { width: 5, opacity: 1 },
                      }
                      : null),
                  }}
                >
                  <TableCell
                    padding="checkbox"
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      width: COL_CHECKBOX,
                      maxWidth: COL_CHECKBOX,
                      pl: 1.5,
                      position: "relative",
                      overflow: "visible",
                    }}
                  >
                    <Box
                      className="finding-rowStripe"
                      sx={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width:
                          f.severity === "critical" || f.severity === "high" ? 4 : 3,
                        backgroundColor: severityBorderColors[f.severity],
                        // Улучшенный контраст для всех уровней severity
                        opacity:
                          f.severity === "critical" || f.severity === "high" ? 1 : 0.7,
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                      sx={{ position: "relative", zIndex: 1 }}
                    />
                  </TableCell>

                  {/* Issue details */}
                  <TableCell sx={{ minWidth: 0, overflow: "hidden" }}>
                    <Stack
                      spacing={compactMode ? 0 : 0.5}
                      sx={{ minWidth: 0, overflow: "hidden" }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <Tooltip
                          title={
                            primaryLabel ? (
                              <Box sx={{ maxWidth: 520, wordBreak: "break-word" }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {primaryLabel}
                                </Typography>
                              </Box>
                            ) : (
                              ""
                            )
                          }
                          placement="top-start"
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {primaryLabel || "—"}
                          </Typography>
                        </Tooltip>

                        {/* Repeat count - minimal */}
                        {occurrence === "REPEAT" && repeats > 0 && (
                          <Tooltip title={`Detected ${repeats} times`}>
                            <Typography
                              component="span"
                              sx={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                color: "#ffb74d",
                                flexShrink: 0,
                              }}
                            >
                              ×{repeats}
                            </Typography>
                          </Tooltip>
                        )}
                      </Stack>

                      {shouldShowRule && ruleId && (
                        <Tooltip title={ruleId} placement="top-start">
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            {(() => {
                              const { display: smartTitle, isShortened } = formatSmartTitle(ruleId);
                              return (
                                <Box component="span" sx={{ minWidth: 0 }}>
                                  Rule: {renderHighlightedTitle(isShortened ? smartTitle : ruleId)}
                                </Box>
                              );
                            })()}
                          </Typography>
                        </Tooltip>
                      )}

                      {message && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {message}
                        </Typography>
                      )}

                      {/* Category badge only - compact, no icons */}
                      {(isSca || isSast || isSecrets || isConfig) && (
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            px: 0.6,
                            py: 0.15,
                            mt: 0.25,
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "0.6rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                            ...(isSast && {
                              bgcolor: "rgba(156, 39, 176, 0.12)",
                              color: "#ce93d8",
                              border: "1px solid rgba(156, 39, 176, 0.3)",
                            }),
                            ...(isSca && {
                              bgcolor: "rgba(100, 181, 246, 0.12)",
                              color: "#90caf9",
                              border: "1px solid rgba(100, 181, 246, 0.3)",
                            }),
                            ...(isSecrets && {
                              bgcolor: "rgba(255, 193, 7, 0.12)",
                              color: "#ffd54f",
                              border: "1px solid rgba(255, 193, 7, 0.3)",
                            }),
                            ...(isConfig && {
                              bgcolor: "rgba(0, 188, 212, 0.12)",
                              color: "#4dd0e1",
                              border: "1px solid rgba(0, 188, 212, 0.3)",
                            }),
                          }}
                        >
                          {isSast && "SAST"}
                          {isSca && "SCA"}
                          {isSecrets && "SECRETS"}
                          {isConfig && "CONFIG"}
                        </Box>
                      )}

                      {/* метаданные (только НЕ compact) — FIX: не рисуем пустое и не делаем “серую полосу” */}
                      {!compactMode &&
                        (() => {
                          const productLabel = (f.productName ?? "").trim();
                          const scannerRaw = (f.scannerType ?? "").trim();
                          const lastSeenLabel = lastSeenAt ? formatDate(lastSeenAt) : "";

                          const metaItems: Array<{
                            key: "product" | "scanner" | "lastSeen";
                            icon: ReactNode;
                            label: string;
                            maxWidth?: number;
                          }> = [];

                          if (productLabel) {
                            metaItems.push({
                              key: "product",
                              icon: <InventoryIcon sx={{ fontSize: 14, color: "text.disabled" }} />,
                              label: productLabel,
                              maxWidth: 340,
                            });
                          }

                          if (scannerRaw) {
                            metaItems.push({
                              key: "scanner",
                              icon: (
                                <RadarIcon
                                  sx={{ fontSize: 14, color: "text.disabled" }}
                                />
                              ),
                              label: prettifyScanner(scannerRaw),
                              maxWidth: 180,
                            });
                          }

                          if (lastSeenAt) {
                            metaItems.push({
                              key: "lastSeen",
                              icon: <ScheduleIcon sx={{ fontSize: 13, color: "text.disabled" }} />,
                              label: lastSeenLabel,
                              maxWidth: 220,
                            });
                          }

                          if (metaItems.length === 0) return null;

                          return (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 0.75,
                                mt: 0.25,
                                color: "text.secondary",
                                minWidth: 0,
                              }}
                            >
                              {metaItems.map((m) => (
                                <Tooltip key={m.key} title={m.label} placement="top-start">
                                  <Box
                                    sx={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 0.6,
                                      px: 0.9,
                                      py: 0.25,
                                      borderRadius: 1,
                                      border: "1px solid",
                                      borderColor: "divider",
                                      bgcolor: "action.hover",
                                      minWidth: 0,
                                      maxWidth: "100%",
                                    }}
                                  >
                                    {m.icon}
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: 600,
                                        minWidth: 0,
                                        maxWidth: m.maxWidth ?? 260,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {m.label}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              ))}
                            </Box>
                          );
                        })()}
                    </Stack>
                  </TableCell>

                  {/* Severity - Compact */}
                  <TableCell
                    align="center"
                    sx={{
                      width: COL_SEVERITY,
                      maxWidth: COL_SEVERITY,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(() => {
                      const config = severityConfig[f.severity];
                      return (
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            px: 1,
                            py: 0.25,
                            minWidth: 56,
                            borderRadius: "10px",
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                            color: config.color,
                            bgcolor: config.bgcolor,
                            border: config.borderColor ? `1px solid ${config.borderColor}` : "none",
                          }}
                        >
                          {severityLabels[f.severity]}
                        </Box>
                      );
                    })()}
                  </TableCell>

                  {/* Risk */}
                  <TableCell
                    align="center"
                    sx={{
                      width: COL_RISK,
                      maxWidth: COL_RISK,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(() => {
                      const score =
                        typeof f.riskScore === "number" ? Math.round(f.riskScore) : null;
                      const band = f.riskBand as RiskBand | null | undefined;
                      if (score === null || !band) {
                        return (
                          <Tooltip title="Risk not computed yet">
                            <Box component="span" sx={{ color: "text.secondary" }}>
                              —
                            </Box>
                          </Tooltip>
                        );
                      }
                      return (
                        <Tooltip title="Risk = Likelihood × Impact (OWASP)">
                          <Chip
                            size="small"
                            label={`${riskBandShortLabels[band]} ${score}`}
                            sx={{
                              height: 24,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              borderColor: RISK_BAND_COLORS[band],
                              color: RISK_BAND_COLORS[band],
                              bgcolor: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid",
                              "& .MuiChip-label": { px: 0.8 },
                            }}
                          />
                        </Tooltip>
                      );
                    })()}
                  </TableCell>

                  {/* Status - Compact */}
                  <TableCell
                    align="center"
                    sx={{
                      width: COL_STATUS,
                      maxWidth: COL_STATUS,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(() => {
                      const config = statusConfig[f.status];
                      return (
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            px: 0.75,
                            py: 0.25,
                            borderRadius: "10px",
                            fontWeight: 500,
                            fontSize: "0.65rem",
                            color: config.color,
                            bgcolor: config.bgcolor,
                            border: config.borderColor ? `1px solid ${config.borderColor}` : "none",
                          }}
                        >
                          {statusLabels[f.status] ?? f.status}
                        </Box>
                      );
                    })()}
                  </TableCell>

                  {/* SLA - Compact */}
                  <TableCell
                    align="center"
                    sx={{
                      width: COL_SLA,
                      maxWidth: COL_SLA,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Tooltip
                      title={
                        slaDisplay.dueAtLabel
                          ? `Due: ${slaDisplay.dueAtLabel}`
                          : "SLA not set"
                      }
                    >
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          px: 0.75,
                          py: 0.2,
                          minWidth: 60,
                          borderRadius: "10px",
                          fontWeight: 600,
                          fontSize: "0.6rem",
                          color: slaDisplay.color,
                          bgcolor: slaDisplay.bgcolor,
                          border: `1px solid ${slaDisplay.borderColor}`,
                          textTransform: "uppercase",
                        }}
                      >
                        {slaDisplay.label}
                      </Box>
                    </Tooltip>
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    align="right"
                    sx={{ width: COL_ACTIONS, maxWidth: COL_ACTIONS }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip title="Открыть на отдельной странице">
                      <IconButton
                        size="small"
                        component={Link}
                        to={buildFindingLink(f.id, returnTo)}
                        onClick={() => onNavigateToDetail()}
                        aria-label="Открыть на отдельной странице"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
