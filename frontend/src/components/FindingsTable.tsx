import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Stack,
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
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
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

const tableContainerSx = {
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  maxHeight: "70vh",
  "& .MuiTableCell-head": {
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: "background.paper",
  },
  "& .MuiTableCell-root": {
    py: 1,
    px: 1.5,
  },
} as const;

const titleCellSx = {
  maxWidth: 560,
} as const;

const sublineSx = {
  color: "text.secondary",
  display: "block",
  fontSize: "0.75rem",
} as const;

const actionCellSx = {
  width: 120,
  textAlign: "right",
  whiteSpace: "nowrap",
} as const;

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
}: FindingsTableProps) {
  const safeData = Array.isArray(data) ? data : [];

  const allSelected =
    safeData.length > 0 && selectedIds.length === safeData.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

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

  const buildDetailLink = (id: string) =>
    returnTo
      ? `/findings/${id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/findings/${id}`;

  const getPermalink = (id: string) => {
    if (typeof window === "undefined") return buildDetailLink(id);
    return `${window.location.origin}${buildDetailLink(id)}`;
  };

  const handleCopy = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard errors
    }
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
      if (matchIndex > startIndex) parts.push(title.slice(startIndex, matchIndex));
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
      sx={tableContainerSx}
    >
      <Table stickyHeader size="small" sx={{ minWidth: 920 }}>
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

            <TableCell sx={{ width: "46%" }}>
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

            <TableCell sx={{ width: 150 }}>
              <TableSortLabel
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder : "asc"}
                onClick={() => onSortChange("status")}
              >
                Status
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 170, display: { xs: "none", md: "table-cell" } }}>
              <TableSortLabel
                active={sortField === "lastSeenAt"}
                direction={sortField === "lastSeenAt" ? sortOrder : "asc"}
                onClick={() => onSortChange("lastSeenAt")}
              >
                Last seen
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 120, display: { xs: "none", lg: "table-cell" } }}>
              Occurrence
            </TableCell>
            <TableCell sx={actionCellSx}>Actions</TableCell>
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
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell sx={actionCellSx}>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell align="right">
                  <Skeleton width={28} height={28} />
                </TableCell>
              </TableRow>
            ))}

          {!loading && errorMessage && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
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
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
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
              const isSelected = selectedIds.includes(f.id);

              const occurrence: FindingOccurrenceStatus = (f.occurrenceStatus ?? "NEW") as FindingOccurrenceStatus;
              const repeatCount = f.repeatCount ?? 0;

              const lastSeenAt = f.lastSeenAt || f.updatedAt;

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
                    "& td": { verticalAlign: "middle" },
                    ...(isActive && !isSelected
                      ? {
                          bgcolor: "action.selected",
                          "&:hover": { bgcolor: "action.selected" },
                        }
                      : null),
                  }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </TableCell>

                  <TableCell
                    sx={titleCellSx}
                  >
                    <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        {batchMode ? (
                          <Tooltip title={f.title} placement="top-start">
                            <Typography color="text.primary" noWrap sx={{ fontWeight: 600 }}>
                              {renderHighlightedTitle(f.title)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Tooltip title={f.title} placement="top-start">
                            <MuiLink
                              component={Link}
                              to={buildDetailLink(f.id)}
                              underline="hover"
                              sx={{ display: "inline-block", maxWidth: "100%" }}
                              onClick={(e) => {
                                if (onOpenDetail && !isModifiedClick(e)) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onNavigateToDetail();
                                  onOpenDetail(f.id);
                                } else {
                                  onNavigateToDetail();
                                }
                              }}
                            >
                              <Typography component="span" noWrap sx={{ fontWeight: 600 }}>
                                {renderHighlightedTitle(f.title)}
                              </Typography>
                            </MuiLink>
                          </Tooltip>
                        )}

                        {repeatCount > 1 && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`x${repeatCount}`}
                            sx={{ fontSize: "0.7rem", height: 20 }}
                          />
                        )}
                      </Stack>

                      <Tooltip
                        title={`App: ${f.productName || "—"} • Scanner: ${prettifyScanner(
                          f.scannerType
                        )} • Last seen: ${formatDate(lastSeenAt)}`}
                      >
                        <Typography noWrap sx={sublineSx}>
                          App: {f.productName || "—"} • Scanner:{" "}
                          {prettifyScanner(f.scannerType)} • Last seen:{" "}
                          {formatDate(lastSeenAt)}
                        </Typography>
                      </Tooltip>
                    </Stack>
                  </TableCell>

                  {/* Severity */}
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity]}
                      sx={{ ...severityChipSx[f.severity], fontWeight: 600 }}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      label={statusLabels[f.status] ?? f.status}
                      color={statusColors[f.status]}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: "none", fontWeight: 500 }}
                    />
                  </TableCell>

                  <TableCell
                    sx={{ whiteSpace: "nowrap", display: { xs: "none", md: "table-cell" } }}
                  >
                    <Typography variant="body2">{formatDate(lastSeenAt)}</Typography>
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, whiteSpace: "nowrap" }}>
                    <Chip
                      label={occurrenceLabels[occurrence] ?? occurrence}
                      color={occurrenceColors[occurrence]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </TableCell>

                  <TableCell sx={actionCellSx}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Открыть деталь">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Открыть ${f.title}`}
                            component={Link}
                            to={buildDetailLink(f.id)}
                            onClick={(e) => {
                              if (onOpenDetail && !isModifiedClick(e)) {
                                e.preventDefault();
                                e.stopPropagation();
                                onNavigateToDetail();
                                onOpenDetail(f.id);
                                return;
                              }
                              if (!isModifiedClick(e)) {
                                onNavigateToDetail();
                              }
                            }}
                            disabled={batchMode || loading || Boolean(errorMessage)}
                          >
                            <OpenInNewIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Скопировать ссылку">
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Скопировать permalink"
                            onClick={() => handleCopy(getPermalink(f.id))}
                          >
                            <LinkIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Скопировать ID">
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Скопировать ID"
                            onClick={() => handleCopy(f.id)}
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
