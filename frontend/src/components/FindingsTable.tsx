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
import RepeatIcon from "@mui/icons-material/Repeat";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AppsIcon from "@mui/icons-material/Apps";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { ReactNode, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Finding,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

/**
 * Ширины колонок.
 * Issue details занимает всё оставшееся место (flex-col).
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

const severityChipSx: Record<FindingSeverity, any> = {
  low: { borderColor: "success.main", color: "success.main" },
  medium: { borderColor: "warning.main", color: "warning.main" },
  high: { borderColor: "error.main", color: "error.main" },
  critical: { borderColor: "secondary.main", color: "secondary.main" },
};

// Цвета для левой индикационной полосы
const severityBorderColors: Record<FindingSeverity, string> = {
  low: "#4caf50",
  medium: "#ff9800",
  high: "#f44336",
  critical: "#9c27b0",
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

const statusColors: Record<
  FindingStatus,
  "default" | "info" | "success" | "warning"
> = {
  new: "info",
  under_review: "warning",
  confirmed: "success",
  false_positive: "default",
  out_of_scope: "default",
  risk_accepted: "warning",
  mitigated: "success",
  duplicate: "default",
};

const occurrenceLabels: Record<FindingOccurrenceStatus, string> = {
  NEW: "New",
  REPEAT: "Repeated",
};

const occurrenceColors: Record<
  FindingOccurrenceStatus,
  "default" | "info" | "warning"
> = {
  NEW: "default",
  REPEAT: "warning",
};

interface FindingsTableProps {
  data: Finding[];
  selectedIds: string[];
  sortField: keyof Finding;
  sortOrder: "asc" | "desc";
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onSortChange: (field: keyof Finding) => void;
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
}

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
}: FindingsTableProps) {
  const safeData = Array.isArray(data) ? data : [];

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
  const renderHighlightedTitle = useCallback((title: string) => {
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
  }, [normalizedQuery]);

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
          tableLayout: "fixed", // чтобы ширины колонок не прыгали :contentReference[oaicite:2]{index=2}
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
              <TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary" gutterBottom>
                  Ничего не найдено по фильтрам
                </Typography>
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ cursor: "pointer" }}
                  onClick={onResetFilters}
                >
                  Сбросить фильтры
                </Typography>
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

              const handleRowClick = () => {
                if (batchMode) onToggleOne(f.id);
                else onOpenDetails(f.id);
              };

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
                    position: "relative",
                    "& td": { verticalAlign: "middle" },

                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: f.severity === "critical" || f.severity === "high" ? 4 : 3,
                      backgroundColor: severityBorderColors[f.severity],
                      opacity: f.severity === "critical" || f.severity === "high" ? 1 : 0.5,
                      transition: "all 0.2s ease",
                    },
                    "&:hover::before": { width: 4, opacity: 1 },
                    ...(isActive && !isSelected
                      ? {
                        bgcolor: "action.selected",
                        "&:hover": { bgcolor: "action.selected" },
                      }
                      : null),
                  }}
                >
                  <TableCell
                    padding="checkbox"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ width: COL_CHECKBOX, maxWidth: COL_CHECKBOX, pl: 1.5 }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </TableCell>

                  {/* Issue details */}
                  <TableCell sx={{ minWidth: 0, overflow: "hidden" }}>
                    <Stack spacing={compactMode ? 0 : 0.5} sx={{ minWidth: 0, overflow: "hidden" }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <Tooltip title={f.title} placement="top-start">
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
                            {renderHighlightedTitle(f.title)}
                          </Typography>
                        </Tooltip>

                        {/* повторяемость */}
                        {occurrence === "REPEAT" && repeats > 0 && (
                          <Tooltip title={`Найдено повторно ${repeats} раз`} placement="top">
                            <Chip
                              size="small"
                              icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                              label={`${repeats}x`}
                              sx={{
                                flexShrink: 0,
                                height: 22,
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                bgcolor: "warning.light",
                                color: "warning.dark",
                                border: "1.5px solid",
                                borderColor: "warning.main",
                                "& .MuiChip-icon": { color: "warning.dark", ml: 0.5 },
                              }}
                            />
                          </Tooltip>
                        )}

                        {occurrence === "REPEAT" && !repeats && (
                          <Chip
                            size="small"
                            label={occurrenceLabels[occurrence]}
                            color={occurrenceColors[occurrence]}
                            sx={{ flexShrink: 0, height: 22 }}
                          />
                        )}

                        {/* возраст */}
                        {showAgeWarning && (
                          <Tooltip title={`Найдена ${ageDays} дн. назад`} placement="top">
                            <Chip
                              size="small"
                              icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                              label={getAgeLabel(ageDays)}
                              sx={{
                                flexShrink: 0,
                                height: 22,
                                fontSize: "0.7rem",
                                bgcolor: ageDays >= 90 ? "error.light" : "grey.300",
                                color: ageDays >= 90 ? "error.dark" : "text.secondary",
                                "& .MuiChip-icon": {
                                  color: ageDays >= 90 ? "error.dark" : "text.secondary",
                                  ml: 0.5,
                                },
                              }}
                            />
                          </Tooltip>
                        )}
                      </Stack>

                      {/* метаданные (только НЕ compact) */}
                      {!compactMode && (
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.75rem",
                            overflow: "hidden",
                            minWidth: 0,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <AppsIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                                maxWidth: 220,
                              }}
                            >
                              {f.productName || "—"}
                            </Typography>
                          </Stack>

                          <Box sx={{ width: 1, height: 12, bgcolor: "divider", flexShrink: 0 }} />

                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <QrCodeScannerIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {prettifyScanner(f.scannerType)}
                            </Typography>
                          </Stack>

                          <Box sx={{ width: 1, height: 12, bgcolor: "divider", flexShrink: 0 }} />

                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <ScheduleIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                              {formatDate(lastSeenAt)}
                            </Typography>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Severity */}
                  <TableCell
                    align="center"
                    sx={{ width: COL_SEVERITY, maxWidth: COL_SEVERITY, whiteSpace: "nowrap" }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity]}
                      sx={{
                        ...severityChipSx[f.severity],
                        height: 22,
                        maxWidth: "100%",
                        "& .MuiChip-label": {
                          px: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      }}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell
                    align="center"
                    sx={{ width: COL_STATUS, maxWidth: COL_STATUS, whiteSpace: "nowrap" }}
                  >
                    <Chip
                      label={statusLabels[f.status] ?? f.status}
                      color={statusColors[f.status]}
                      size="small"
                      sx={{
                        height: 22,
                        maxWidth: "100%",
                        textTransform: "none",
                        "& .MuiChip-label": {
                          px: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      }}
                    />
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
