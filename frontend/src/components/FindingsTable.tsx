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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Finding,
  FindingSeverity,
  FindingStatus,
} from "../types/findings";

const severityLabels: Record<FindingSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
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
}

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
}: FindingsTableProps) => {
  // 🛡️ ВТОРИЧНАЯ ЗАЩИТА
  const safeData = Array.isArray(data) ? data : [];

  const allSelected =
    safeData.length > 0 &&
    selectedIds.length === safeData.length;

  const someSelected =
    selectedIds.length > 0 && !allSelected;

  const renderHighlightedTitle = (title: string) => {
    const query = highlightQuery.trim();
    if (!query) {
      return title;
    }
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
            backgroundColor: "rgba(255, 193, 7, 0.25)",
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
    <TableContainer>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) =>
                  onToggleAll(e.target.checked)
                }
                disabled={loading || Boolean(errorMessage)}
              />
            </TableCell>
            <TableCell>ID</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "title"}
                direction={
                  sortField === "title"
                    ? sortOrder
                    : "asc"
                }
                onClick={() => onSortChange("title")}
              >
                Название
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "productName"}
                direction={
                  sortField === "productName"
                    ? sortOrder
                    : "asc"
                }
                onClick={() =>
                  onSortChange("productName")
                }
              >
                Приложение
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "severity"}
                direction={
                  sortField === "severity"
                    ? sortOrder
                    : "asc"
                }
                onClick={() =>
                  onSortChange("severity")
                }
              >
                Критичность
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "status"}
                direction={
                  sortField === "status"
                    ? sortOrder
                    : "asc"
                }
                onClick={() =>
                  onSortChange("status")
                }
              >
                Статус
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "createdAt"}
                direction={
                  sortField === "createdAt"
                    ? sortOrder
                    : "asc"
                }
                onClick={() =>
                  onSortChange("createdAt")
                }
              >
                Дата
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading &&
            Array.from({ length: Math.max(rowCount, 5) }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rectangular" width={20} height={20} />
                </TableCell>
                <TableCell>
                  <Skeleton width={120} />
                </TableCell>
                <TableCell>
                  <Skeleton width="80%" />
                </TableCell>
                <TableCell>
                  <Skeleton width={160} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton width={120} />
                </TableCell>
                <TableCell>
                  <Skeleton width={140} />
                </TableCell>
              </TableRow>
            ))}
          {!loading && errorMessage && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary" gutterBottom>
                  {errorMessage}
                </Typography>
                <IconButton
                  color="primary"
                  aria-label="Повторить"
                  onClick={onRetry}
                >
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
              const isSelected =
                selectedIds.includes(f.id);
              const shortId = f.id.slice(0, 8);

              return (
                <TableRow
                  key={f.id}
                  hover
                  selected={isSelected}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() =>
                        onToggleOne(f.id)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {shortId}
                      </Typography>
                      <Tooltip title="Скопировать полный ID">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigator.clipboard.writeText(f.id)
                          }
                          aria-label="Скопировать полный ID"
                        >
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {batchMode ? (
                      <Typography color="text.primary">
                        {renderHighlightedTitle(f.title)}
                      </Typography>
                    ) : (
                      <MuiLink
                        component={Link}
                        to={`/findings/${f.id}`}
                        underline="hover"
                      >
                        {renderHighlightedTitle(f.title)}
                      </MuiLink>
                    )}
                  </TableCell>
                  <TableCell>
                    {f.productName || "—"}
                  </TableCell>
                  <TableCell>
                    {severityLabels[f.severity]}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={f.status}
                      color={statusColors[f.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(f.createdAt).toLocaleString(
                      "ru-RU"
                    )}
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
