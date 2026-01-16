import {
  Checkbox,
  Chip,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
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
}

const FindingsTable = ({
  data,
  selectedIds,
  sortField,
  sortOrder,
  onToggleAll,
  onToggleOne,
  onSortChange,
}: FindingsTableProps) => {
  // 🛡️ ВТОРИЧНАЯ ЗАЩИТА
  const safeData = Array.isArray(data) ? data : [];

  const allSelected =
    safeData.length > 0 &&
    selectedIds.length === safeData.length;

  const someSelected =
    selectedIds.length > 0 && !allSelected;

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
          {safeData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary">
                  Ничего не найдено
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            safeData.map((f) => {
              const isSelected =
                selectedIds.includes(f.id);

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
                  <TableCell>{f.id}</TableCell>
                  <TableCell>
                    <MuiLink component={Link} to={`/findings/${f.id}`} underline="hover">
                      {f.title}
                    </MuiLink>
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
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FindingsTable;
