import {
  Box,
  Chip,
  ChipProps,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import { ReactNode } from "react";
import { tableStyles } from "../design-system/utils/tableStyles";
import { radius } from "../design-system/tokens";

interface DataTableProps {
  children: ReactNode;
  minWidth?: number;
  stickyHeader?: boolean;
  zebra?: boolean;
  size?: "small" | "medium";
  tableLayout?: "auto" | "fixed";
  maxHeight?: number | string;
  borderless?: boolean;
}

const DataTable = ({
  children,
  minWidth = 760,
  stickyHeader = true,
  zebra = false,
  size = "small",
  tableLayout = "fixed",
  maxHeight = "70vh",
  borderless = false,
}: DataTableProps) => (
  <TableContainer
    sx={{
      borderRadius: borderless ? 0 : 2,
      border: borderless ? "none" : "1px solid",
      borderColor: borderless ? "transparent" : "divider",
      overflowX: "auto",
      overflowY: "auto",
      maxHeight,
      backgroundColor: borderless ? "transparent" : "background.paper",
      "& .MuiTableCell-head": {
        backgroundColor: tableStyles.headerBg,
        color: tableStyles.headerText,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: "0.7rem",
        borderBottom: `1px solid ${tableStyles.cellBorder}`,
        whiteSpace: "nowrap",
        py: tableStyles.cellPaddingY,
        px: tableStyles.cellPaddingX,
      },
      "& .MuiTableCell-body": {
        borderBottom: `1px solid ${tableStyles.cellBorder}`,
        fontSize: "0.875rem",
        py: tableStyles.cellPaddingY,
        px: tableStyles.cellPaddingX,
      },
      "& .MuiTableRow-root": {
        height: tableStyles.rowHeight,
        transition: "background-color 0.2s ease",
        "&:hover": {
          backgroundColor: tableStyles.rowHover,
        },
        "&.Mui-selected": {
          backgroundColor: tableStyles.rowSelected,
          "&:hover": {
            backgroundColor: tableStyles.rowSelected,
          },
        },
      },
      ...(zebra && {
        "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
          backgroundColor: tableStyles.rowZebra,
        },
      }),
    }}
  >
    <Table
      stickyHeader={stickyHeader}
      size={size}
      sx={{
        width: "100%",
        minWidth,
        tableLayout,
      }}
    >
      {children}
    </Table>
  </TableContainer>
);

interface TableEmptyStateProps {
  colSpan: number;
  title: string;
  description?: string;
  hint?: string;
  action?: ReactNode;
}

export const TableEmptyState = ({
  colSpan,
  title,
  description,
  hint,
  action,
}: TableEmptyStateProps) => (
  <TableRow>
    <TableCell colSpan={colSpan} align="center" sx={{ py: 6 }}>
      <Stack spacing={0.5} alignItems="center">
        <Typography fontWeight={600}>{title}</Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
        {action && <Box>{action}</Box>}
      </Stack>
    </TableCell>
  </TableRow>
);

interface TableLoadingRowsProps {
  rowCount: number;
  cellCount: number;
  checkbox?: boolean;
}

export const TableLoadingRows = ({ rowCount, cellCount, checkbox = false }: TableLoadingRowsProps) => (
  <>
    {Array.from({ length: rowCount }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {Array.from({ length: cellCount }).map((__, cellIndex) => (
          <TableCell key={`skeleton-${index}-${cellIndex}`}>
            {checkbox && cellIndex === 0 ? (
              <Skeleton variant="rectangular" width={18} height={18} />
            ) : (
              <Skeleton width="70%" />
            )}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

export const TableChip = ({ sx, ...props }: ChipProps) => (
  <Chip
    size="small"
    {...props}
    sx={{
      height: 24,
      fontSize: "0.7rem",
      fontWeight: 600,
      borderRadius: radius.full,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      "& .MuiChip-label": {
        px: 1,
      },
      ...sx,
    }}
  />
);

export const TableActions = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>{children}</Box>
);

export default DataTable;
