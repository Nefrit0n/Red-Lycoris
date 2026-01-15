import {
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
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

const statusColors: Record<FindingStatus, "default" | "info" | "success" | "warning"> = {
  new: "info",
  duplicate: "default",
  resolved: "success",
  ignored: "warning",
};

interface FindingsTableProps {
  data: Finding[];
  selectedIds: string[];
  sortField: keyof Finding | "";
  sortOrder: "asc" | "desc" | "";
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
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <TableContainer aria-label="Таблица находок">
      <Table size="medium" stickyHeader aria-label="Список находок">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                inputProps={{ "aria-label": "Выбрать все находки" }}
              />
            </TableCell>
            <TableCell>ID</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "title"}
                direction={sortField === "title" ? sortOrder || "asc" : "asc"}
                onClick={() => onSortChange("title")}
              >
                Название
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "productName"}
                direction={
                  sortField === "productName" ? sortOrder || "asc" : "asc"
                }
                onClick={() => onSortChange("productName")}
              >
                Приложение
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "severity"}
                direction={sortField === "severity" ? sortOrder || "asc" : "asc"}
                onClick={() => onSortChange("severity")}
              >
                Уровень критичности
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "status"}
                direction={sortField === "status" ? sortOrder || "asc" : "asc"}
                onClick={() => onSortChange("status")}
              >
                Статус
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === "createdAt"}
                direction={
                  sortField === "createdAt" ? sortOrder || "asc" : "asc"
                }
                onClick={() => onSortChange("createdAt")}
              >
                Дата обнаружения
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                <Typography variant="body1" color="text.secondary">
                  Ничего не найдено
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.map((finding) => {
              const isSelected = selectedIds.includes(finding.id);

              return (
                <TableRow
                  key={finding.id}
                  hover
                  selected={isSelected}
                  sx={{
                    transition: "background-color 0.2s ease",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleOne(finding.id)}
                      inputProps={{
                        "aria-label": `Выбрать находку ${finding.id}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>{finding.id}</TableCell>
                  <TableCell>{finding.title}</TableCell>
                  <TableCell>{finding.productName}</TableCell>
                  <TableCell>{severityLabels[finding.severity]}</TableCell>
                  <TableCell>
                    <Chip
                      label={finding.status}
                      color={statusColors[finding.status]}
                      size="small"
                      sx={{ textTransform: "capitalize" }}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(finding.createdAt).toLocaleString("ru-RU", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
