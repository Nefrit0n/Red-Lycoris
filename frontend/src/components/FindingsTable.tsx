/**
 * FindingsTable - Triage-optimized table for RED LYCORIS
 *
 * Key design principles:
 * - Minimal colors: only severity stripe on left
 * - Clean typography: monochrome text
 * - Sticky header for long lists
 * - Compact rows for maximum density
 * - All detailed info moved to details drawer
 */

import {
  Box,
  Button,
  Checkbox,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ReactNode, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FindingListItemDTO,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";
import { buildFindingLink } from "../utils/findingFormatters";
import { semantic, primitives } from "../design-system/tokens/colors";
import DataTable, { TableEmptyState, TableLoadingRows } from "./DataTable";

// Compact column widths
const COL_CHECKBOX = 44;
const COL_SEVERITY = 80;
const COL_STATUS = 100;
const COL_CATEGORY = 72;
const COL_PRODUCT = 120;
const COL_ACTIONS = 40;

// Severity colors for left stripe only
const severityColors: Record<FindingSeverity, string> = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
};

// Severity labels
const severityLabels: Record<FindingSeverity, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  critical: "Crit",
};

// Status labels - simple text
const statusLabels: Record<FindingStatus, string> = {
  new: "New",
  under_review: "Review",
  confirmed: "Confirmed",
  false_positive: "FP",
  out_of_scope: "OOS",
  risk_accepted: "Accepted",
  mitigated: "Mitigated",
  duplicate: "Dup",
};

// Status groups for styling
const openStatuses = new Set<FindingStatus>(["new", "under_review", "confirmed"]);
const resolvedStatuses = new Set<FindingStatus>([
  "mitigated",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "duplicate",
]);

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
  returnTo: string;
  onNavigateToDetail: () => void;
  onOpenDetails: (id: string) => void;
  activeFindingId?: string | null;
  compactMode?: boolean;
  groupByRule?: boolean;
}

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

  // Highlight search matches
  const normalizedQuery = highlightQuery.trim();
  const renderHighlightedText = useCallback(
    (text: string) => {
      const query = normalizedQuery;
      if (!query) return text;

      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();

      const parts: ReactNode[] = [];
      let startIndex = 0;
      let matchIndex = lowerText.indexOf(lowerQuery);

      while (matchIndex !== -1) {
        if (matchIndex > startIndex) parts.push(text.slice(startIndex, matchIndex));
        parts.push(
          <Box
            key={`${text}-${matchIndex}-${startIndex}`}
            component="span"
            sx={{
              backgroundColor: alpha(primitives.gold[500], 0.3),
              fontWeight: 600,
              px: 0.25,
              borderRadius: 0.5,
            }}
          >
            {text.slice(matchIndex, matchIndex + lowerQuery.length)}
          </Box>
        );
        startIndex = matchIndex + lowerQuery.length;
        matchIndex = lowerText.indexOf(lowerQuery, startIndex);
      }

      if (startIndex < text.length) parts.push(text.slice(startIndex));
      return parts;
    },
    [normalizedQuery]
  );

  const colCount = 7; // checkbox + title + severity + status + category + product + actions

  // Row height for compact mode
  const cellPy = compactMode ? 0.5 : 1;

  return (
    <DataTable minWidth={800} tableLayout="fixed" stickyHeader borderless maxHeight="none">
      <colgroup>
        <col style={{ width: COL_CHECKBOX }} />
        <col /> {/* title (auto) */}
        <col style={{ width: COL_SEVERITY }} />
        <col style={{ width: COL_STATUS }} />
        <col style={{ width: COL_CATEGORY }} />
        <col style={{ width: COL_PRODUCT }} />
        <col style={{ width: COL_ACTIONS }} />
      </colgroup>

      <TableHead>
        <TableRow
          sx={{
            "& th": {
              bgcolor: primitives.night[800],
              borderBottom: "1px solid",
              borderColor: primitives.night[600],
              py: 1,
              position: "sticky",
              top: 0,
              zIndex: 2,
            },
          }}
        >
          <TableCell padding="checkbox" sx={{ width: COL_CHECKBOX }}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
              disabled={loading || Boolean(errorMessage) || safeData.length === 0}
              inputProps={{ "aria-label": "Select all" }}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </TableCell>

          <TableCell sx={{ pl: 1 }}>
            <TableSortLabel
              active={sortField === "title"}
              direction={sortField === "title" ? sortOrder : "asc"}
              onClick={() => onSortChange("title")}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: primitives.night[300], fontSize: "0.7rem" }}
              >
                TITLE
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_SEVERITY }}>
            <TableSortLabel
              active={sortField === "severity"}
              direction={sortField === "severity" ? sortOrder : "asc"}
              onClick={() => onSortChange("severity")}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: primitives.night[300], fontSize: "0.7rem" }}
              >
                SEV
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_STATUS }}>
            <TableSortLabel
              active={sortField === "status"}
              direction={sortField === "status" ? sortOrder : "asc"}
              onClick={() => onSortChange("status")}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: primitives.night[300], fontSize: "0.7rem" }}
              >
                STATUS
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_CATEGORY }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: primitives.night[300], fontSize: "0.7rem" }}
            >
              TYPE
            </Typography>
          </TableCell>

          <TableCell sx={{ width: COL_PRODUCT }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: primitives.night[300], fontSize: "0.7rem" }}
            >
              PRODUCT
            </Typography>
          </TableCell>

          <TableCell align="right" sx={{ width: COL_ACTIONS }} />
        </TableRow>
      </TableHead>

      <TableBody>
        {loading && (
          <TableLoadingRows rowCount={Math.max(rowCount, 10)} cellCount={colCount} checkbox />
        )}

        {!loading && errorMessage && (
          <TableRow>
            <TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>
              <Typography color="text.secondary" gutterBottom>
                {errorMessage}
              </Typography>
              <IconButton color="primary" aria-label="Retry" onClick={onRetry}>
                <RefreshIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        )}

        {!loading && !errorMessage && safeData.length === 0 && (
          <TableEmptyState
            colSpan={colCount}
            title="No findings found"
            description="Try adjusting your filters or search criteria."
            hint="If there are no findings, upload a scan or select a different product."
            action={
              <Button variant="contained" size="small" onClick={onResetFilters}>
                Reset filters
              </Button>
            }
          />
        )}

        {!loading &&
          !errorMessage &&
          safeData.map((f) => {
            const isSelected = selectedIdSet.has(f.id);
            const isActive = Boolean(activeFindingId) && activeFindingId === f.id;
            const severityColor = severityColors[f.severity];
            const isOpen = openStatuses.has(f.status);
            const isResolved = resolvedStatuses.has(f.status);

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
                  "& td": { verticalAlign: "middle", py: cellPy },
                  borderBottom: "1px solid",
                  borderColor: primitives.night[700],
                  transition: "background-color 0.1s ease",
                  "&:hover": {
                    bgcolor: `${alpha(primitives.night[600], 0.4)} !important`,
                    "& .severity-stripe": { width: 5 },
                  },
                  ...(isActive && {
                    bgcolor: alpha(primitives.lotus[500], 0.08),
                    "&:hover": { bgcolor: alpha(primitives.lotus[500], 0.12) },
                  }),
                }}
              >
                {/* Checkbox with severity stripe */}
                <TableCell
                  padding="checkbox"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ position: "relative", pl: 1 }}
                >
                  <Box
                    className="severity-stripe"
                    sx={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: f.severity === "critical" || f.severity === "high" ? 4 : 3,
                      backgroundColor: severityColor,
                      opacity: f.severity === "critical" || f.severity === "high" ? 1 : 0.5,
                      transition: "width 0.1s ease",
                    }}
                  />
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggleOne(f.id)}
                    inputProps={{ "aria-label": `Select ${f.title}` }}
                    size="small"
                  />
                </TableCell>

                {/* Title */}
                <TableCell sx={{ minWidth: 0, overflow: "hidden", pl: 1 }}>
                  <Tooltip title={f.title} placement="top-start" enterDelay={400}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.8125rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: primitives.night[100],
                      }}
                    >
                      {renderHighlightedText(f.title || "—")}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Severity - text only with color */}
                <TableCell align="center" sx={{ width: COL_SEVERITY }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      color: severityColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {severityLabels[f.severity]}
                  </Typography>
                </TableCell>

                {/* Status - subtle text */}
                <TableCell align="center" sx={{ width: COL_STATUS }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.7rem",
                      color: isOpen
                        ? primitives.night[200]
                        : isResolved
                        ? primitives.night[500]
                        : primitives.night[400],
                      fontWeight: isOpen ? 500 : 400,
                    }}
                  >
                    {statusLabels[f.status] ?? f.status}
                  </Typography>
                </TableCell>

                {/* Category - simple text */}
                <TableCell align="center" sx={{ width: COL_CATEGORY }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.7rem",
                      color: primitives.night[400],
                    }}
                  >
                    {f.category || "—"}
                  </Typography>
                </TableCell>

                {/* Product */}
                <TableCell sx={{ width: COL_PRODUCT }}>
                  <Tooltip title={f.productName || ""} placement="top-start" enterDelay={400}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.7rem",
                        color: primitives.night[400],
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {f.productName || "—"}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Actions */}
                <TableCell
                  align="right"
                  sx={{ width: COL_ACTIONS, pr: 1 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip title="Open in new page">
                    <IconButton
                      size="small"
                      component={Link}
                      to={buildFindingLink(f.id, returnTo)}
                      onClick={() => onNavigateToDetail()}
                      aria-label="Open in new page"
                      sx={{
                        p: 0.5,
                        color: primitives.night[500],
                        "&:hover": { color: primitives.night[300] },
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </DataTable>
  );
}
