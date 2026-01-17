import {
  Checkbox,
  Chip,
  Link as MuiLink,
  IconButton,
  ListItemIcon,
  ListItemText,
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
  Stack,
  Typography,
  Tooltip,
  Box,
  Divider,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
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

const occurrenceLabels: Record<FindingOccurrenceStatus, string> = {
  NEW: "New",
  REPEAT: "Repeat",
};

const occurrenceColors: Record<FindingOccurrenceStatus, "default" | "info" | "warning"> = {
  NEW: "info",
  REPEAT: "warning",
};

const HiddenMdDownCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const HiddenLgDownCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down("lg")]: {
    display: "none",
  },
}));

const ActionsCell = styled(TableCell)(({ theme }) => ({
  width: 56,
  paddingLeft: theme.spacing(0.5),
  paddingRight: theme.spacing(0.5),
}));

const TableShell = styled(TableContainer)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const StyledTable = styled(Table)(({ theme }) => ({
  minWidth: 1080,
  tableLayout: "fixed",
  "& .MuiTableCell-head": {
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: theme.palette.background.paper,
  },
}));

const IssueCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

const IssueTitleRow = styled(Stack)(({ theme }) => ({
  alignItems: "center",
  gap: theme.spacing(1),
  minWidth: 0,
  flexWrap: "nowrap",
}));

const IssueStack = styled(Stack)(() => ({
  minWidth: 0,
}));

const IssueTitleText = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const IssueMetaText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
}));

const MetaDivider = styled("span")(({ theme }) => ({
  margin: `0 ${theme.spacing(1)}`,
  color: theme.palette.text.disabled,
}));

const IssueLink = styled(MuiLink)(() => ({
  display: "inline-block",
  minWidth: 0,
  maxWidth: "100%",
  flex: "1 1 auto",
}));

const SeverityChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "severity",
})<{ severity: FindingSeverity }>(({ theme, severity }) => {
  const paletteMap: Record<FindingSeverity, keyof typeof theme.palette> = {
    low: "success",
    medium: "warning",
    high: "error",
    critical: "secondary",
  };
  const paletteKey = paletteMap[severity];
  const palette = theme.palette[paletteKey];
  return {
    borderColor: palette.main,
    color: palette.main,
    backgroundColor: alpha(palette.main, 0.12),
    fontWeight: 600,
  };
});

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "status",
})<{ status: FindingStatus }>(({ theme, status }) => {
  const paletteKey: Record<FindingStatus, keyof typeof theme.palette> = {
    new: "info",
    under_review: "warning",
    confirmed: "success",
    false_positive: "grey",
    out_of_scope: "grey",
    risk_accepted: "warning",
    mitigated: "success",
    duplicate: "grey",
  };
  const palette = theme.palette[paletteKey[status]];
  const mainColor = "main" in palette ? palette.main : theme.palette.text.secondary;
  return {
    borderColor: mainColor,
    color: mainColor,
    backgroundColor: alpha(mainColor, 0.12),
    textTransform: "none",
    fontWeight: 500,
  };
});

const RepeatBadge = styled(Chip)(({ theme }) => ({
  borderColor: theme.palette.divider,
  color: theme.palette.text.secondary,
  fontWeight: 600,
}));

const DenseCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
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

  const allSelected = safeData.length > 0 && selectedIds.length === safeData.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const [actionFinding, setActionFinding] = useState<Finding | null>(null);
  const actionsOpen = Boolean(actionAnchorEl);

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

  const handleOpenActions = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, finding: Finding) => {
      event.stopPropagation();
      setActionAnchorEl(event.currentTarget);
      setActionFinding(finding);
    },
    []
  );

  const handleCloseActions = useCallback(() => {
    setActionAnchorEl(null);
    setActionFinding(null);
  }, []);

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, []);

  const handleOpenFromMenu = useCallback(() => {
    if (!actionFinding) return;
    if (onOpenDetail && !batchMode && !loading && !errorMessage) {
      onNavigateToDetail();
      onOpenDetail(actionFinding.id);
    } else {
      window.location.assign(buildDetailLink(actionFinding.id));
    }
    handleCloseActions();
  }, [
    actionFinding,
    batchMode,
    errorMessage,
    handleCloseActions,
    loading,
    onNavigateToDetail,
    onOpenDetail,
  ]);

  const handleCopyPermalink = useCallback(async () => {
    if (!actionFinding) return;
    const url = `${window.location.origin}${buildDetailLink(actionFinding.id)}`;
    await copyToClipboard(url);
    handleCloseActions();
  }, [actionFinding, copyToClipboard, handleCloseActions]);

  const handleCopyId = useCallback(async () => {
    if (!actionFinding) return;
    await copyToClipboard(actionFinding.id);
    handleCloseActions();
  }, [actionFinding, copyToClipboard, handleCloseActions]);

  return (
    <TableShell>
      <StyledTable stickyHeader size="small">
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

            <TableCell sx={{ width: "48%" }}>
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

            <TableCell sx={{ width: 140 }}>
              <TableSortLabel
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder : "asc"}
                onClick={() => onSortChange("status")}
              >
                Status
              </TableSortLabel>
            </TableCell>

            <HiddenMdDownCell sx={{ width: 190 }}>
              <TableSortLabel
                active={sortField === "lastSeenAt"}
                direction={sortField === "lastSeenAt" ? sortOrder : "asc"}
                onClick={() => onSortChange("lastSeenAt")}
              >
                Last seen
              </TableSortLabel>
            </HiddenMdDownCell>

            <HiddenLgDownCell sx={{ width: 120 }}>
              Occurrence
            </HiddenLgDownCell>

            <HiddenLgDownCell sx={{ width: 160 }}>
              Owner
            </HiddenLgDownCell>

            <ActionsCell align="right">Actions</ActionsCell>
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
                <HiddenMdDownCell>
                  <Skeleton width={110} />
                </HiddenMdDownCell>
                <HiddenLgDownCell>
                  <Skeleton width={90} />
                </HiddenLgDownCell>
                <HiddenLgDownCell>
                  <Skeleton width={120} />
                </HiddenLgDownCell>
                <ActionsCell>
                  <Skeleton width={24} />
                </ActionsCell>
              </TableRow>
            ))}

          {!loading && errorMessage && (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
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
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
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

              const ownerLabel = f.owner?.name || f.assigneeId || "—";
              const lastSeenAt = f.lastSeenAt || f.updatedAt;
              const showRepeatBadge = occurrence === "REPEAT" || repeatCount > 1;
              const repeatLabel = repeatCount > 1 ? `Repeat x${repeatCount}` : "Repeat";

              const isActive = Boolean(activeId) && f.id === activeId;

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

                  <IssueCell>
                    {batchMode ? (
                      <Tooltip title={f.title} placement="top-start">
                        <IssueStack spacing={0.5}>
                          <IssueTitleRow direction="row">
                            <IssueTitleText noWrap>
                              {renderHighlightedTitle(f.title)}
                            </IssueTitleText>
                            {showRepeatBadge && (
                              <RepeatBadge
                                size="small"
                                variant="outlined"
                                label={repeatLabel}
                              />
                            )}
                          </IssueTitleRow>
                          <IssueMetaText variant="caption" noWrap>
                            App: {f.productName || "—"}
                            <MetaDivider>•</MetaDivider>
                            Scanner: {prettifyScanner(f.scannerType)}
                            <MetaDivider>•</MetaDivider>
                            Last seen: {formatDate(lastSeenAt)}
                          </IssueMetaText>
                        </IssueStack>
                      </Tooltip>
                    ) : (
                      <IssueStack spacing={0.5}>
                        <IssueTitleRow direction="row">
                          <Tooltip title={f.title} placement="top-start">
                            <IssueLink
                              component={Link}
                              to={buildDetailLink(f.id)}
                              underline="hover"
                              onClick={(e) => {
                                // ✅ если включен Drawer-режим — открываем панель
                                if (onOpenDetail && !isModifiedClick(e)) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onNavigateToDetail();
                                  onOpenDetail(f.id);
                                } else {
                                  // обычная навигация на detail page
                                  onNavigateToDetail();
                                }
                              }}
                            >
                              <IssueTitleText component="span" noWrap>
                                {renderHighlightedTitle(f.title)}
                              </IssueTitleText>
                            </IssueLink>
                          </Tooltip>
                          {showRepeatBadge && (
                            <RepeatBadge
                              size="small"
                              variant="outlined"
                              label={repeatLabel}
                            />
                          )}
                        </IssueTitleRow>
                          <IssueMetaText variant="caption" noWrap>
                            App: {f.productName || "—"}
                            <MetaDivider>•</MetaDivider>
                            Scanner: {prettifyScanner(f.scannerType)}
                            <MetaDivider>•</MetaDivider>
                            Last seen: {formatDate(lastSeenAt)}
                          </IssueMetaText>
                      </IssueStack>
                    )}
                  </IssueCell>

                  <DenseCell sx={{ whiteSpace: "nowrap" }}>
                    <SeverityChip
                      size="small"
                      variant="outlined"
                      severity={f.severity}
                      label={severityLabels[f.severity]}
                    />
                  </DenseCell>

                  <DenseCell sx={{ whiteSpace: "nowrap" }}>
                    <StatusChip
                      status={f.status}
                      label={statusLabels[f.status] ?? f.status}
                      size="small"
                      variant="outlined"
                    />
                  </DenseCell>

                  <HiddenMdDownCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{formatDate(lastSeenAt)}</Typography>
                  </HiddenMdDownCell>

                  <HiddenLgDownCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      label={occurrenceLabels[occurrence] ?? occurrence}
                      color={occurrenceColors[occurrence]}
                      size="small"
                      sx={{ textTransform: "none" }}
                    />
                  </HiddenLgDownCell>

                  <HiddenLgDownCell sx={{ maxWidth: 160 }}>
                    <Tooltip title={ownerLabel}>
                      <Typography variant="body2" noWrap>
                        {ownerLabel}
                      </Typography>
                    </Tooltip>
                  </HiddenLgDownCell>

                  <ActionsCell align="right">
                    <Tooltip title="Действия">
                      <IconButton
                        size="small"
                        aria-label={`Действия для ${f.title}`}
                        onClick={(event) => handleOpenActions(event, f)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ActionsCell>
                </TableRow>
              );
            })}
        </TableBody>
      </StyledTable>

      <Menu
        anchorEl={actionAnchorEl}
        open={actionsOpen}
        onClose={handleCloseActions}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleOpenFromMenu}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Открыть деталь" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleCopyPermalink}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Копировать permalink" />
        </MenuItem>
        <MenuItem onClick={handleCopyId}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Копировать ID" />
        </MenuItem>
      </Menu>
    </TableShell>
  );
};

export default FindingsTable;
