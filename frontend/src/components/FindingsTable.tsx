import {
  Box,
  Checkbox,
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
import RepeatIcon from "@mui/icons-material/Repeat";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FiberNewIcon from "@mui/icons-material/FiberNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import VerifiedIcon from "@mui/icons-material/Verified";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InventoryIcon from "@mui/icons-material/Inventory";
import RadarIcon from "@mui/icons-material/Radar";
import { ReactNode, useCallback, useMemo, useState } from "react";
import SecurityIcon from "@mui/icons-material/Security";
import { Link } from "react-router-dom";
import {
  FindingListItemDTO,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

/**
 * Ширины колонок.
 * Issue details занимает всё оставшееся место.
 */
const COL_CHECKBOX = 44;
const COL_SEVERITY = 140;
const COL_STATUS = 160;
const COL_ACTIONS = 56;

const severityLabels: Record<FindingSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// Новая конфигурация severity с заливкой и иконками
const severityConfig: Record<FindingSeverity, {
  bgcolor: string;
  color: string;
  borderColor?: string;
  icon: React.ReactNode;
  glow?: string;
}> = {
  critical: {
    bgcolor: "linear-gradient(135deg, #d32f2f 0%, #7b1fa2 100%)",
    color: "#ffffff",
    icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} />,
    glow: "0 0 12px rgba(211, 47, 47, 0.4)",
  },
  high: {
    bgcolor: "#d32f2f",
    color: "#ffffff",
    icon: <WarningAmberIcon sx={{ fontSize: 14 }} />,
  },
  medium: {
    bgcolor: "rgba(255, 152, 0, 0.15)",
    color: "#ffb74d",
    borderColor: "rgba(255, 152, 0, 0.5)",
    icon: <ReportProblemOutlinedIcon sx={{ fontSize: 14 }} />,
  },
  low: {
    bgcolor: "rgba(76, 175, 80, 0.1)",
    color: "#81c784",
    borderColor: "rgba(76, 175, 80, 0.3)",
    icon: <InfoOutlinedIcon sx={{ fontSize: 14 }} />,
  },
};

// Цвета для левой индикационной полосы
const severityBorderColors: Record<FindingSeverity, string> = {
  low: "#4caf50",
  medium: "#ff9800",
  high: "#f44336",
  critical: "#d32f2f",
};

// Цвета фона строк для critical/high findings (subtle tint)
const severityRowBgColors: Record<FindingSeverity, string | null> = {
  critical: "rgba(211, 47, 47, 0.06)",
  high: "rgba(244, 67, 54, 0.04)",
  medium: null,
  low: null,
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

// Новая конфигурация статусов с иконками и семантической группировкой
const statusConfig: Record<FindingStatus, {
  icon: React.ReactNode;
  bgcolor: string;
  color: string;
  borderColor?: string;
  pulse?: boolean; // для "New" статуса
}> = {
  // === Требует внимания (Action Required) ===
  new: {
    icon: <FiberNewIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(33, 150, 243, 0.15)",
    color: "#64b5f6",
    borderColor: "rgba(33, 150, 243, 0.5)",
    pulse: true,
  },
  under_review: {
    icon: <VisibilityIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(255, 152, 0, 0.12)",
    color: "#ffb74d",
    borderColor: "rgba(255, 152, 0, 0.4)",
  },
  confirmed: {
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(244, 67, 54, 0.12)",
    color: "#ef5350",
    borderColor: "rgba(244, 67, 54, 0.4)",
  },

  // === Закрыто (Resolved) ===
  mitigated: {
    icon: <VerifiedIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(76, 175, 80, 0.12)",
    color: "#81c784",
    borderColor: "rgba(76, 175, 80, 0.4)",
  },
  false_positive: {
    icon: <BlockIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
  out_of_scope: {
    icon: <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
  risk_accepted: {
    icon: <ThumbUpAltOutlinedIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(255, 193, 7, 0.1)",
    color: "#ffd54f",
    borderColor: "rgba(255, 193, 7, 0.3)",
  },
  duplicate: {
    icon: <ContentCopyIcon sx={{ fontSize: 14 }} />,
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
};

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

  const colCount = 5; // checkbox + issue + severity + status + actions

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
          minWidth: 980,
          tableLayout: "fixed", // чтобы ширины колонок не прыгали
        }}
      >
        {/* ВАЖНО: colgroup должен быть первым ребёнком table */}
        <colgroup>
          <col style={{ width: COL_CHECKBOX }} />
          <col /> {/* issue details (auto) */}
          <col style={{ width: COL_SEVERITY }} />
          <col style={{ width: COL_STATUS }} />
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
                <TableCell align="center" sx={{ width: COL_STATUS }}>
                  <Skeleton width={110} />
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

                        {/* повторяемость - улучшенный badge */}
                        {occurrence === "REPEAT" && repeats > 0 && (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Repeated {repeats} times
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  This finding was detected in multiple scans
                                </Typography>
                              </Box>
                            }
                            placement="top"
                          >
                            <Box
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1,
                                py: 0.25,
                                borderRadius: "12px",
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                bgcolor: "rgba(255, 152, 0, 0.15)",
                                color: "#ffb74d",
                                border: "1px solid rgba(255, 152, 0, 0.4)",
                                flexShrink: 0,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  bgcolor: "rgba(255, 152, 0, 0.25)",
                                },
                              }}
                            >
                              <RepeatIcon sx={{ fontSize: 12 }} />
                              {repeats}x
                            </Box>
                          </Tooltip>
                        )}

                        {occurrence === "REPEAT" && !repeats && (
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              px: 1,
                              py: 0.25,
                              borderRadius: "12px",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                              bgcolor: "rgba(255, 152, 0, 0.1)",
                              color: "#ffb74d",
                              border: "1px solid rgba(255, 152, 0, 0.3)",
                              flexShrink: 0,
                            }}
                          >
                            <RepeatIcon sx={{ fontSize: 12 }} />
                            Repeat
                          </Box>
                        )}

                        {/* возраст - улучшенный badge */}
                        {showAgeWarning && (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {ageDays >= 90 ? "Old finding" : "Aging finding"}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  First detected {ageDays} days ago
                                </Typography>
                              </Box>
                            }
                            placement="top"
                          >
                            <Box
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1,
                                py: 0.25,
                                borderRadius: "12px",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                flexShrink: 0,
                                transition: "all 0.2s ease",
                                // Красный для старых (90+ дней), серый для остальных
                                ...(ageDays >= 90
                                  ? {
                                    bgcolor: "rgba(244, 67, 54, 0.15)",
                                    color: "#ef5350",
                                    border: "1px solid rgba(244, 67, 54, 0.4)",
                                  }
                                  : {
                                    bgcolor: "rgba(158, 158, 158, 0.1)",
                                    color: "#9e9e9e",
                                    border: "1px solid rgba(158, 158, 158, 0.3)",
                                  }),
                                "&:hover": {
                                  transform: "scale(1.02)",
                                },
                              }}
                            >
                              <ScheduleIcon sx={{ fontSize: 12 }} />
                              {getAgeLabel(ageDays)}
                            </Box>
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

                      {(cvssScore !== null || epssScore !== null || isKev || isSca) && (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.25 }}
                        >
                          {isSca && (
                            <Tooltip title="Software Composition Analysis (dependencies)">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  bgcolor: "rgba(158, 158, 158, 0.16)",
                                  color: "rgba(255, 255, 255, 0.78)",
                                  border: "1px solid rgba(255, 255, 255, 0.14)",
                                }}
                              >
                                <SecurityIcon sx={{ fontSize: 14 }} />
                                SCA
                              </Box>
                            </Tooltip>
                          )}
                          {cvssScore !== null && (
                            <Tooltip
                              title={`CVSS${cvssVersion ? ` v${cvssVersion}` : ""}: ${cvssScore.toFixed(
                                1
                              )}`}
                            >
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  bgcolor:
                                    cvssScore >= 9
                                      ? "rgba(244, 67, 54, 0.2)"
                                      : cvssScore >= 7
                                        ? "rgba(255, 152, 0, 0.2)"
                                        : "rgba(76, 175, 80, 0.2)",
                                  color:
                                    cvssScore >= 9
                                      ? "#ef5350"
                                      : cvssScore >= 7
                                        ? "#ffb74d"
                                        : "#81c784",
                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                }}
                              >
                                CVSS {cvssScore.toFixed(1)}
                              </Box>
                            </Tooltip>
                          )}
                          {epssScore !== null && (
                            <Tooltip
                              title={`EPSS: ${(epssScore * 100).toFixed(2)}%${
                                epssPercentile !== null
                                  ? ` (p${(epssPercentile * 100).toFixed(1)})`
                                  : ""
                              }`}
                            >
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  bgcolor: "rgba(33, 150, 243, 0.15)",
                                  color: "#64b5f6",
                                  border: "1px solid rgba(100, 181, 246, 0.4)",
                                }}
                              >
                                EPSS {(epssScore * 100).toFixed(1)}%
                              </Box>
                            </Tooltip>
                          )}
                          {isKev && (
                            <Tooltip title="Known Exploited Vulnerability">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  bgcolor: "rgba(255, 82, 82, 0.2)",
                                  color: "#ff8a80",
                                  border: "1px solid rgba(255, 82, 82, 0.5)",
                                }}
                              >
                                KEV
                              </Box>
                            </Tooltip>
                          )}
                        </Stack>
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

                  {/* Severity */}
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
                      const isGradient = config.bgcolor.includes("gradient");
                      return (
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1.25,
                            py: 0.5,
                            borderRadius: "16px",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.025em",
                            color: config.color,
                            background: config.bgcolor,
                            border: config.borderColor ? `1px solid ${config.borderColor}` : "none",
                            boxShadow: config.glow ?? "none",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              transform: "scale(1.02)",
                            },
                            "& .MuiSvgIcon-root": {
                              color: config.color,
                            },
                          }}
                        >
                          {config.icon}
                          {severityLabels[f.severity]}
                        </Box>
                      );
                    })()}
                  </TableCell>

                  {/* Status */}
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
                            gap: 0.5,
                            px: 1.25,
                            py: 0.5,
                            borderRadius: "16px",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            color: config.color,
                            bgcolor: config.bgcolor,
                            border: config.borderColor ? `1px solid ${config.borderColor}` : "none",
                            transition: "all 0.2s ease",
                            // Пульсация для "New" статуса
                            ...(config.pulse && {
                              animation: "statusPulse 2s ease-in-out infinite",
                              "@keyframes statusPulse": {
                                "0%, 100%": {
                                  boxShadow: `0 0 0 0 ${config.borderColor}`,
                                },
                                "50%": {
                                  boxShadow: `0 0 0 4px transparent`,
                                },
                              },
                            }),
                            "& .MuiSvgIcon-root": {
                              color: config.color,
                            },
                          }}
                        >
                          {config.icon}
                          {statusLabels[f.status] ?? f.status}
                        </Box>
                      );
                    })()}
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
