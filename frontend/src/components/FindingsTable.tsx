/**
 * FindingsTable - Minimalist redesign for RED LYCORIS
 *
 * Key design principles:
 * - Minimal colors: only severity stripe on left
 * - Clean typography: monochrome text
 * - Status as subtle text, not colored badges
 * - All detailed info (CVSS, EPSS, KEV, CWE, etc.) moved to details drawer
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

// Column widths
const COL_CHECKBOX = 48;
const COL_SEVERITY = 90;
const COL_STATUS = 120;
const COL_CATEGORY = 80;
const COL_PRODUCT = 140;
const COL_ACTIONS = 48;

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
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// Status labels - simple text
const statusLabels: Record<FindingStatus, string> = {
  new: "New",
  under_review: "Under review",
  confirmed: "Confirmed",
  false_positive: "False positive",
  out_of_scope: "Out of scope",
  risk_accepted: "Accepted",
  mitigated: "Mitigated",
  duplicate: "Duplicate",
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

  return (
    <DataTable minWidth={900} tableLayout="fixed">
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
              bgcolor: alpha(primitives.night[700], 0.5),
              borderBottom: "1px solid",
              borderColor: primitives.night[600],
              py: 1.5,
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

          <TableCell>
            <TableSortLabel
              active={sortField === "title"}
              direction={sortField === "title" ? sortOrder : "asc"}
              onClick={() => onSortChange("title")}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Title
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_SEVERITY }}>
            <TableSortLabel
              active={sortField === "severity"}
              direction={sortField === "severity" ? sortOrder : "asc"}
              onClick={() => onSortChange("severity")}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Severity
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_STATUS }}>
            <TableSortLabel
              active={sortField === "status"}
              direction={sortField === "status" ? sortOrder : "asc"}
              onClick={() => onSortChange("status")}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Status
              </Typography>
            </TableSortLabel>
          </TableCell>

          <TableCell align="center" sx={{ width: COL_CATEGORY }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Type
            </Typography>
          </TableCell>

          <TableCell sx={{ width: COL_PRODUCT }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Product
            </Typography>
          </TableCell>

          <TableCell align="right" sx={{ width: COL_ACTIONS }} />
        </TableRow>
      </TableHead>

      <TableBody>
        {loading && (
          <TableLoadingRows rowCount={Math.max(rowCount, 8)} cellCount={colCount} checkbox />
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
                  "& td": { verticalAlign: "middle", py: compactMode ? 1 : 1.5 },
                  borderBottom: "1px solid",
                  borderColor: primitives.night[700],
                  transition: "background-color 0.15s ease",
                  "&:hover": {
                    bgcolor: `${alpha(primitives.night[600], 0.5)} !important`,
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
                  sx={{ position: "relative", pl: 1.5 }}
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
                      opacity: f.severity === "critical" || f.severity === "high" ? 1 : 0.6,
                      transition: "width 0.15s ease",
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
                <TableCell sx={{ minWidth: 0, overflow: "hidden" }}>
                  <Tooltip
                    title={f.title}
                    placement="top-start"
                    enterDelay={500}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "text.primary",
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
                      fontWeight: 600,
                      color: severityColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
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
                      color: isOpen
                        ? primitives.night[200]
                        : isResolved
                        ? primitives.night[400]
                        : primitives.night[300],
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
                      color: primitives.night[300],
                      fontWeight: 500,
                    }}
                  >
                    {f.category || "—"}
                  </Typography>
                </TableCell>

                {/* Product */}
                <TableCell sx={{ width: COL_PRODUCT }}>
                  <Tooltip title={f.productName || ""} placement="top-start" enterDelay={500}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: primitives.night[300],
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
                  sx={{ width: COL_ACTIONS }}
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
                        color: primitives.night[400],
                        "&:hover": { color: primitives.night[200] },
                      }}
                    >
                      <OpenInNewIcon fontSize="small" />
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
