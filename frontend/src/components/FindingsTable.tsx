import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Skeleton,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ReactNode, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const tableContainerSx = {
  borderRadius: 2,
  "& .MuiTableCell-head": {
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: "background.paper",
  },
  "& .MuiTableRow-root:hover": {
    backgroundColor: "action.hover",
  },
};

const tableSx = {
  minWidth: 980,
  tableLayout: "fixed" as const,
};

const issueCellSx = {
  maxWidth: 620,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaLineSx = {
  display: "block",
  color: "text.secondary",
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

  /**
   * ✅ Если передан — таблица НЕ уходит на роут,
   * а открывает деталь через Drawer/side panel.
   */
  onOpenDetail?: (id: string) => void;

  /**
   * (опционально) подсветка “активной” строки,
   * когда деталь открыта справа
   */
  activeId?: string | null;
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

const isModifiedClick = (e: React.MouseEvent) =>
  e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button === 1;

const clickedInteractive = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'a,button,input,textarea,select,label,[role="button"],[role="checkbox"]'
    )
  );
};

const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
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
  onOpenDetail,
  activeId,
}: FindingsTableProps) => {
  const navigate = useNavigate();
  const safeData = Array.isArray(data) ? data : [];

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuFinding, setMenuFinding] = useState<Finding | null>(null);

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
    returnTo ? `/findings/${id}?returnTo=${encodeURIComponent(returnTo)}` : `/findings/${id}`;

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

    if (startIndex < title.length) parts.push(title.slice(startIndex));
    return parts;
  };

  const canOpenDetail = Boolean(onOpenDetail) && !batchMode && !loading && !errorMessage;

  const handleOpenDetail = (id: string) => {
    if (!onOpenDetail) return;
    onOpenDetail(id);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, finding: Finding) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuFinding(finding);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuFinding(null);
  };

  const handleOpenFromMenu = (finding: Finding) => {
    handleMenuClose();
    if (onOpenDetail) {
      onNavigateToDetail();
      onOpenDetail(finding.id);
      return;
    }
    onNavigateToDetail();
    navigate(buildDetailLink(finding.id));
  };

  const handleCopyPermalink = async (finding: Finding) => {
    const url = `${window.location.origin}${buildDetailLink(finding.id)}`;
    await copyTextToClipboard(url);
    handleMenuClose();
  };

  const handleCopyId = async (finding: Finding) => {
    await copyTextToClipboard(finding.id);
    handleMenuClose();
  };

  return (
    <TableContainer sx={tableContainerSx}>
      <Table stickyHeader size="small" sx={tableSx}>
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

            <TableCell sx={{ width: "50%" }}>
              <TableSortLabel
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder : "asc"}
                onClick={() => onSortChange("title")}
              >
                Issue details
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 120 }}>
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

            <TableCell sx={{ width: 160, display: { xs: "none", md: "table-cell" } }}>
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

            <TableCell align="right" sx={{ width: 64 }}>
              Actions
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
                  <Skeleton width="60%" />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton width={110} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={140} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                  <Skeleton width={90} />
                </TableCell>
                <TableCell align="right">
                  <Skeleton width={32} />
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

              const occurrence: FindingOccurrenceStatus = (f.occurrenceStatus ?? "NEW") as FindingOccurrenceStatus;
              const repeatCount = f.repeatCount ?? 0;
              const repeatLabel =
                repeatCount > 1
                  ? `Repeat ×${repeatCount}`
                  : occurrence === "REPEAT"
                    ? "Repeat"
                    : "";

              const lastSeenAt = f.lastSeenAt || f.updatedAt;
              const scannerLabel = prettifyScanner(f.scannerType);
              const productLabel = f.productName || f.productId || "—";

              const isActive = Boolean(activeId) && f.id === activeId;

              const metaLine = `App: ${productLabel} • Scanner: ${scannerLabel} • Last seen: ${formatDate(lastSeenAt)}`;

              return (
                <TableRow
                  key={f.id}
                  hover
                  selected={isSelected || isActive}
                  onClick={(e) => {
                    if (!canOpenDetail) return;
                    if (clickedInteractive(e.target)) return;
                    handleOpenDetail(f.id);
                  }}
                  sx={{
                    "& td": { verticalAlign: "middle" },
                    cursor: canOpenDetail ? "pointer" : "default",
                    ...(isActive
                      ? {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: "-2px",
                        }
                      : null),
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </TableCell>

                  <TableCell sx={issueCellSx}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
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
                              underline="hover"
                              sx={{ display: "inline-flex", maxWidth: "100%" }}
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
                              <Typography component="span" noWrap>
                                {renderHighlightedTitle(f.title)}
                              </Typography>
                            </MuiLink>
                          </Tooltip>
                        )}

                        <Typography variant="caption" noWrap sx={metaLineSx}>
                          {metaLine}
                        </Typography>
                      </Box>

                      {repeatLabel ? (
                        <Chip
                          size="small"
                          label={repeatLabel}
                          variant="outlined"
                          sx={{ fontSize: 11, height: 22 }}
                        />
                      ) : null}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity]}
                      sx={severityChipSx[f.severity]}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={statusLabels[f.status] ?? f.status}
                      color={statusColors[f.status]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Typography variant="body2" noWrap>
                      {formatDate(lastSeenAt)}
                    </Typography>
                  </TableCell>

                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    <Chip
                      label={occurrenceLabels[occurrence] ?? occurrence}
                      color={occurrenceColors[occurrence]}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: "none" }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Действия">
                      <IconButton
                        size="small"
                        aria-label="Действия строки"
                        onClick={(event) => handleMenuOpen(event, f)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor) && Boolean(menuFinding)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            if (!menuFinding) return;
            handleOpenFromMenu(menuFinding);
          }}
        >
          <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} />
          Открыть detail
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!menuFinding) return;
            handleCopyPermalink(menuFinding);
          }}
        >
          <LinkIcon fontSize="small" sx={{ mr: 1 }} />
          Скопировать permalink
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!menuFinding) return;
            handleCopyId(menuFinding);
          }}
        >
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Скопировать ID
        </MenuItem>
      </Menu>
    </TableContainer>
  );
};

export default FindingsTable;
