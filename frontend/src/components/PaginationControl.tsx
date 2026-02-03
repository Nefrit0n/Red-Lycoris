import { Box, CircularProgress, TablePagination, Typography } from "@mui/material";
import { useEffect, useMemo } from "react";

interface PaginationControlProps {
  page: number; // 0-based (как в MUI TablePagination)
  pageSize: number;
  total?: number | null; // общее число результатов (count)
  hasNextPage?: boolean;
  currentCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const PaginationControl = ({
  page,
  pageSize,
  total,
  hasNextPage = false,
  currentCount,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: PaginationControlProps) => {
  const totalKnown = typeof total === "number" && Number.isFinite(total) && total >= 0;
  const safeTotal = totalKnown ? total : 0;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;

  const lastPageIndex = useMemo(() => {
    if (!totalKnown) return 0;
    if (safeTotal === 0) return 0;
    return Math.max(0, Math.ceil(safeTotal / safePageSize) - 1);
  }, [safeTotal, safePageSize, totalKnown]);

  const safePage = useMemo(() => {
    if (!totalKnown) {
      return Math.max(0, Number.isFinite(page) ? page : 0);
    }
    return clamp(Number.isFinite(page) ? page : 0, 0, lastPageIndex);
  }, [page, lastPageIndex, totalKnown]);

  // Если total/rowsPerPage изменились и page стала невалидной — мягко возвращаем в диапазон
  useEffect(() => {
    if (safePage !== page) {
      onPageChange(safePage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const resolvedCurrentCount =
    typeof currentCount === "number" && currentCount >= 0 ? currentCount : safePageSize;
  const from =
    safeTotal === 0 && totalKnown
      ? 0
      : !totalKnown && resolvedCurrentCount === 0
        ? 0
        : safePage * safePageSize + 1;
  const to = totalKnown
    ? safeTotal === 0
      ? 0
      : Math.min((safePage + 1) * safePageSize, safeTotal)
    : safePage * safePageSize + resolvedCurrentCount;

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      sx={{ mt: 2 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {totalKnown
            ? `Показано ${from}-${to} из ${safeTotal}`
            : loading
              ? `Показано ${from}-${to}`
              : `Показано ${from}-${to}`}
        </Typography>
        {loading && <CircularProgress size={14} sx={{ color: "text.secondary" }} />}
      </Box>

      <TablePagination
        component="div"
        count={totalKnown ? safeTotal : -1}
        page={safePage}
        onPageChange={(_, nextPage) => onPageChange(nextPage)}
        rowsPerPage={safePageSize}
        onRowsPerPageChange={(event) => {
          const nextSize = Number(event.target.value);
          if (Number.isFinite(nextSize) && nextSize > 0) {
            onPageSizeChange(nextSize);
          }
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Строк на странице"
        labelDisplayedRows={({ from, to, count }) =>
          count === -1 ? `Показано ${from}-${to}` : `Показано ${from}-${to} из ${count}`
        }
        getItemAriaLabel={(type) => {
          if (type === "next") return "Следующая страница";
          if (type === "previous") return "Предыдущая страница";
          if (type === "first") return "Первая страница";
          return "Последняя страница";
        }}
        showFirstButton={false}
        showLastButton={false}
        backIconButtonProps={{ disabled: safePage === 0 }}
        nextIconButtonProps={{
          disabled: totalKnown ? safePage >= lastPageIndex : !hasNextPage,
        }}
      />
    </Box>
  );
};

export default PaginationControl;
