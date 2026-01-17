import {
  Checkbox,
  Chip,
  Link as MuiLink,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Tooltip,
  Box,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
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

const occurrenceLabels: Record<FindingOccurrenceStatus, string> = {
  NEW: "New",
  REPEAT: "Repeat",
};

const occurrenceColors: Record<FindingOccurrenceStatus, "default" | "info" | "warning"> = {
  NEW: "info",
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
  returnTo: string;
  onNavigateToDetail: () => void;
}

const formatDateTimeRu = (value?: string | null) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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

const FindingsTable = ({
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
}: FindingsTableProps) => {
  const safeData = Array.isArray(data) ? data : [];

  const allSelected = safeData.length > 0 && selectedIds.length === safeData.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const dtf = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return null;
    }
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "—";
    return dtf ? dtf.format(dt) : formatDateTimeRu(value);
  };

  const buildDetailLink = (id: string) =>
    returnTo
      ? `/findings/${id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/findings/${id}`;

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
            fontWeight: 600,
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {title.slice(matchIndex, matchIndex + lowerQuery.length)}
        </Box>
      );
      startIndex = matchIndex + lowerQuery.length;
      matchIndex = lowerTitle.indexOf(lowerQuery, startIndex);
    }

    if (startIndex < title.length) {
      parts.push(title.slice(startIndex));
    }

    return parts;
  };

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        "& .MuiTableCell-head": {
          fontWeight: 600,
          whiteSpace: "nowrap",
        },
      }}
    >
      <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ width: 44 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                disabled={loading || Boolean(errorMessage)}
                inputProps={{ "aria-label": "Выбрать все" }}
              />
            </TableCell>

            <TableCell sx={{ width: "42%" }}>
              <TableSortLabel
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder : "asc"}
                onClick={() => onSortChange("title")}
              >
                Название
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }}>
              <TableSortLabel
                active={sortField === "productName"}
                direction={sortField === "productName" ? sortOrder : "asc"}
                onClick={() => onSortChange("productName")}
              >
                Приложение
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 130 }}>
              <TableSortLabel
                active={sortField === "severity"}
                direction={sortField === "severity" ? sortOrder : "asc"}
                onClick={() => onSortChange("severity")}
              >
                Критичность
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }}>
              <TableSortLabel
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder : "asc"}
                onClick={() => onSortChange("status")}
              >
                Статус
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 190 }}>
              <TableSortLabel
                active={sortField === "lastSeenAt"}
                direction={sortField === "lastSeenAt" ? sortOrder : "asc"}
                onClick={() => onSortChange("lastSeenAt")}
              >
                Last seen
              </TableSortLabel>
            </TableCell>

            {/* второстепенные колонки — прячем на маленьких экранах */}
            <TableCell sx={{ width: 110, display: { xs: "none", md: "table-cell" } }}>
              Scanner
            </TableCell>
            <TableCell sx={{ width: 120, display: { xs: "none", md: "table-cell" } }}>
              Occurrence
            </TableCell>
            <TableCell
              align="right"
              sx={{ width: 90, display: { xs: "none", md: "table-cell" } }}
            >
              Repeats
            </TableCell>
            <TableCell sx={{ width: 160, display: { xs: "none", lg: "table-cell" } }}>
              Owner
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading &&
            Array.from({ length: Math.max(rowCount, 6) }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rectangular" width={18} height={18} />
                </TableCell>
                <TableCell>
                  <Skeleton width="85%" />
                </TableCell>
                <TableCell>
                  <Skeleton width={120} />
                </TableCell>
                <TableCell>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell>
                  <Skeleton width={110} />
                </TableCell>
                <TableCell>
                  <Skeleton width={160} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={60} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                  <Skeleton width={120} />
                </TableCell>
              </TableRow>
            ))}

          {!loading && errorMessage && (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
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
              <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary" gutterBottom>
                  Ничего не найдено по фильтрам
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Попробуйте изменить условия поиска.
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
            safeData.length > 0 &&
            safeData.map((f) => {
              const isSelected = selectedIds.includes(f.id);

              const occurrence: FindingOccurrenceStatus = (f.occurrenceStatus ??
                "NEW") as FindingOccurrenceStatus;

              const repeatCount = f.repeatCount ?? 0;

              const ownerLabel = f.owner?.name || f.assigneeId || "—";
              const lastSeenAt = f.lastSeenAt || f.updatedAt;

              return (
                <TableRow key={f.id} hover selected={isSelected} sx={{ "& td": { verticalAlign: "middle" } }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </TableCell>

                  <TableCell
                    sx={{
                      maxWidth: 520,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {batchMode ? (
                      <Tooltip title={f.title} placement="top-start">
                        <Typography color="text.primary" noWrap>
                          {renderHighlightedTitle(f.title)}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Tooltip title={f.title} placement="top-start">
                        <MuiLink
                          component={Link}
                          to={buildDetailLink(f.id)}
                          onClick={onNavigateToDetail}
                          underline="hover"
                          sx={{ display: "inline-block", maxWidth: "100%" }}
                        >
                          <Typography component="span" noWrap>
                            {renderHighlightedTitle(f.title)}
                          </Typography>
                        </MuiLink>
                      </Tooltip>
                    )}
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title={f.productName || "—"}>
                      <Typography variant="body2" noWrap>
                        {f.productName || "—"}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity]}
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

                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{formatDate(lastSeenAt)}</Typography>
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{prettifyScanner(f.scannerType)}</Typography>
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}>
                    <Chip
                      label={occurrenceLabels[occurrence] ?? occurrence}
                      color={occurrenceColors[occurrence]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      display: { xs: "none", md: "table-cell" },
                      fontFamily: "monospace",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {repeatCount}
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, maxWidth: 160 }}>
                    <Tooltip title={ownerLabel}>
                      <Typography variant="body2" noWrap>
                        {ownerLabel}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FindingsTable;
