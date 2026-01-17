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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  styled,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { ReactNode, useCallback, useMemo, useState } from "react";
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

const FindingsTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 1.5,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  maxHeight: "70vh",
  [theme.breakpoints.down("lg")]: {
    maxHeight: "64vh",
  },
  [theme.breakpoints.down("sm")]: {
    maxHeight: "58vh",
  },
  "& .MuiTableCell-head": {
    fontWeight: 700,
    whiteSpace: "nowrap",
    backgroundColor: theme.palette.background.default,
  },
}));

const IssueTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const IssueMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const TitleCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingRight: theme.spacing(2),
}));

const CompactCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

const ActionCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  width: 64,
}));

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
  const safeData = Array.isArray(data) ? data : [];

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuFindingId, setMenuFindingId] = useState<string | null>(null);

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuFindingId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuFindingId(null);
  };

  const menuFinding = useMemo(
    () => safeData.find((item) => item.id === menuFindingId) ?? null,
    [safeData, menuFindingId]
  );

  const copyToClipboard = useCallback(async (value: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }, []);

  const handleCopyPermalink = useCallback(async () => {
    if (!menuFinding) return;
    const detailPath = `/findings/${menuFinding.id}`;
    const permalink = `${window.location.origin}${detailPath}`;
    await copyToClipboard(permalink);
    handleMenuClose();
  }, [copyToClipboard, menuFinding]);

  const handleCopyId = useCallback(async () => {
    if (!menuFinding) return;
    await copyToClipboard(menuFinding.id);
    handleMenuClose();
  }, [copyToClipboard, menuFinding]);

  const handleOpenFromMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!menuFinding) return;
      if (onOpenDetail && !batchMode) {
        event.preventDefault();
        event.stopPropagation();
        onNavigateToDetail();
        onOpenDetail(menuFinding.id);
      } else {
        onNavigateToDetail();
      }
      handleMenuClose();
    },
    [menuFinding, onNavigateToDetail, onOpenDetail, batchMode]
  );

  return (
    <FindingsTableContainer>
      <Table
        stickyHeader
        size="small"
        sx={{ minWidth: 980, tableLayout: "fixed" }}
        aria-label="Findings table"
      >
        <TableHead>
          <TableRow>
            <CompactCell padding="checkbox" sx={{ width: 44 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                disabled={loading || Boolean(errorMessage)}
                inputProps={{ "aria-label": "Выбрать все" }}
              />
            </CompactCell>

            <TableCell sx={{ width: "46%" }}>
              <TableSortLabel
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder : "asc"}
                onClick={() => onSortChange("title")}
              >
                Issue details
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }}>
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

            <TableCell sx={{ width: 190, display: { xs: "none", md: "table-cell" } }}>
              <TableSortLabel
                active={sortField === "lastSeenAt"}
                direction={sortField === "lastSeenAt" ? sortOrder : "asc"}
                onClick={() => onSortChange("lastSeenAt")}
              >
                Last seen
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 120, display: { xs: "none", md: "table-cell" } }}>
              Occurrence
            </TableCell>
            <ActionCell align="right">Actions</ActionCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading &&
            Array.from({ length: Math.max(rowCount, 6) }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <CompactCell padding="checkbox">
                  <Skeleton variant="rectangular" width={18} height={18} />
                </CompactCell>
                <TitleCell>
                  <Skeleton width="85%" />
                </TitleCell>
                <CompactCell>
                  <Skeleton width={90} />
                </CompactCell>
                <CompactCell>
                  <Skeleton width={110} />
                </CompactCell>
                <CompactCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={160} />
                </CompactCell>
                <CompactCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Skeleton width={90} />
                </CompactCell>
                <ActionCell align="right">
                  <Skeleton variant="circular" width={28} height={28} />
                </ActionCell>
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

              const lastSeenAt = f.lastSeenAt || f.updatedAt;

              const isActive = Boolean(activeId) && f.id === activeId;

              const metaLine = `App: ${f.productName || "—"}  •  Scanner: ${
                prettifyScanner(f.scannerType)
              }  •  Last seen: ${formatDate(lastSeenAt)}`;

              const showRepeatBadge = repeatCount > 1 || occurrence === "REPEAT";

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
                  <CompactCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(f.id)}
                      inputProps={{ "aria-label": `Выбрать ${f.title}` }}
                    />
                  </CompactCell>

                  <TitleCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {batchMode ? (
                        <Tooltip title={f.title} placement="top-start">
                          <IssueTitle>{renderHighlightedTitle(f.title)}</IssueTitle>
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
                            <IssueTitle component="span">
                              {renderHighlightedTitle(f.title)}
                            </IssueTitle>
                          </MuiLink>
                        </Tooltip>
                      )}

                      {showRepeatBadge && (
                        <Chip
                          size="small"
                          label={`Repeat ×${repeatCount || 1}`}
                          variant="outlined"
                          color="warning"
                          sx={{ height: 20 }}
                        />
                      )}
                    </Stack>

                    <Tooltip title={metaLine} placement="top-start">
                      <IssueMeta>{metaLine}</IssueMeta>
                    </Tooltip>
                  </TitleCell>

                  <CompactCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={severityLabels[f.severity]}
                      sx={severityChipSx[f.severity]}
                    />
                  </CompactCell>

                  <CompactCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      label={statusLabels[f.status] ?? f.status}
                      color={statusColors[f.status]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </CompactCell>

                  <CompactCell
                    sx={{ whiteSpace: "nowrap", display: { xs: "none", md: "table-cell" } }}
                  >
                    <Typography variant="body2">{formatDate(lastSeenAt)}</Typography>
                  </CompactCell>

                  <CompactCell
                    sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}
                  >
                    <Chip
                      label={occurrenceLabels[occurrence] ?? occurrence}
                      color={occurrenceColors[occurrence]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </CompactCell>

                  <ActionCell align="right">
                    <Tooltip title="Действия">
                      <IconButton
                        size="small"
                        aria-label="Действия"
                        onClick={(event) => handleMenuOpen(event, f.id)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ActionCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          component={Link}
          to={menuFinding ? buildDetailLink(menuFinding.id) : "#"}
          onClick={handleOpenFromMenu}
          disabled={!menuFinding}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Открыть</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyPermalink} disabled={!menuFinding}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Копировать ссылку</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyId} disabled={!menuFinding}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Копировать ID</ListItemText>
        </MenuItem>
      </Menu>
    </FindingsTableContainer>
  );
};

export default FindingsTable;
