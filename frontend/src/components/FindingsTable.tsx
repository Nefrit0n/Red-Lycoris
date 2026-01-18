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
import { ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";

import {
  Finding,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

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
  const p = new URLSearchParams();
  if (returnTo) p.set("returnTo", returnTo);
  const qs = p.toString();
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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    safeData.length > 0 && safeData.every((item) => selectedSet.has(item.id));
  const someSelected =
    safeData.some((item) => selectedSet.has(item.id)) && !allSelected;

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

  const renderHighlightedTitle = (title: string) => {
    const query = highlightQuery.trim();
    if (!query) return title;

    const lowerTitle = title.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const parts: ReactNode[] = [];
    let startIndex = 0;
    let matchIndex = lowerTitle.indexOf(lowerQuery);

    while (matchIndex !== -1) {
      if (matchIndex > startIndex) {
        parts.push(title.slice(startIndex, matchIndex));
      }
      parts.push(
        <Box
          key={`${title}-${matchIndex}`}
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
  };

  const colCount = 5; // checkbox + issue + severity + status + actions

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        overflowX: "auto",
        "& .MuiTableCell-head": { fontWeight: 700, whiteSpace: "nowrap" },
      }}
    >
      <Table stickyHeader size="small" sx={{ minWidth: 920, tableLayout: "fixed" }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ width: 44 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                disabled={loading || Boolean(errorMessage)}
                inputProps={{ "aria-label": "Выбрать все" }}
                onClick={(e) => e.stopPropagation()}
              />
            </TableCell>

            <TableCell sx={{ width: "100%" }}>
              <TableSortLabel
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder : "asc"}
                onClick={() => onSortChange("title")}
              >
                Issue details
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 130 }}>
              <TableSortLabel
                active={sortField === "severity"}
                direction={sortField === "severity" ? sortOrder : "asc"}
                onClick={() => onSortChange("severity")}
              >
                Severity
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 170 }}>
              <TableSortLabel
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder : "asc"}
                onClick={() => onSortChange("status")}
              >
                Status
              </TableSortLabel>
            </TableCell>

            <TableCell align="right" sx={{ width: 64 }}>
              {/* actions */}
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading &&
            Array.from({ length: Math.max(rowCount, 8) }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rectangular" width={18} height={18} />
                </TableCell>
                <TableCell>
                  <Skeleton width="70%" />
                  <Skeleton width="45%" />
                </TableCell>
                <TableCell>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell>
                  <Skeleton width={120} />
                </TableCell>
                <TableCell align="right">
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
              const isSelected = selectedSet.has(f.id);
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
                      ? { bgcolor: "action.selected", "&:hover": { bgcolor: "action.selected" } }
                      : null),
                  }}
                >
                  <TableCell
                    padding="checkbox"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ pl: 1.5 }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </TableCell>

                  <TableCell sx={{ minWidth: 360, pr: 2 }}>
                    <Stack spacing={compactMode ? 0 : 0.5} sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ minWidth: 0, rowGap: 0.5 }}
                      >
                        <Tooltip title={f.title} placement="top-start">
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              minWidth: 0,
                              flex: "1 1 240px",
                              display: "-webkit-box",
                              WebkitLineClamp: compactMode ? 1 : 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {renderHighlightedTitle(f.title)}
                          </Typography>
                        </Tooltip>

                        {occurrence === "REPEAT" && repeats > 0 && (
                          <Tooltip title={`Найдено повторно ${repeats} раз`} placement="top">
                            <Chip
                              size="small"
                              icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                              label={`${repeats}x`}
                              sx={{
                                height: 24,
                                fontWeight: 700,
                                fontSize: "0.75rem",
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
                            sx={{ height: 22 }}
                          />
                        )}

                        {showAgeWarning && (
                          <Tooltip title={`Найдена ${ageDays} дн. назад`} placement="top">
                            <Chip
                              size="small"
                              icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                              label={getAgeLabel(ageDays)}
                              sx={{
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

                      {!compactMode && (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ color: "text.secondary", fontSize: "0.75rem", rowGap: 0.5 }}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AppsIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {f.productName || "—"}
                            </Typography>
                          </Stack>

                          <Box sx={{ width: 1, height: 12, bgcolor: "divider" }} />

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <QrCodeScannerIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {prettifyScanner(f.scannerType)}
                            </Typography>
                          </Stack>

                          <Box sx={{ width: 1, height: 12, bgcolor: "divider" }} />

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <ScheduleIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                              {formatDate(lastSeenAt)}
                            </Typography>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity] ?? f.severity}
                      sx={severityChipSx[f.severity]}
                    />
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      label={statusLabels[f.status] ?? f.status}
                      color={statusColors[f.status]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
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
