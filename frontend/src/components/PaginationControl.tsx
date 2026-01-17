import { Box, TablePagination, Typography } from "@mui/material";
import { useEffect, useMemo } from "react";

interface PaginationControlProps {
  page: number; // 0-based (как в MUI TablePagination) :contentReference[oaicite:2]{index=2}
  pageSize: number;
  total: number; // общее число результатов (count) :contentReference[oaicite:3]{index=3}
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const PaginationControl = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlProps) => {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;

  const lastPageIndex = useMemo(() => {
    if (safeTotal === 0) return 0;
    return Math.max(0, Math.ceil(safeTotal / safePageSize) - 1);
  }, [safeTotal, safePageSize]);

  const safePage = useMemo(() => {
    return clamp(Number.isFinite(page) ? page : 0, 0, lastPageIndex);
  }, [page, lastPageIndex]);

  // Если total/rowsPerPage изменились и page стала невалидной — мягко возвращаем в диапазон
  useEffect(() => {
    if (safePage !== page) {
      onPageChange(safePage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const from = safeTotal === 0 ? 0 : safePage * safePageSize + 1;
  const to = safeTotal === 0 ? 0 : Math.min((safePage + 1) * safePageSize, safeTotal);

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      sx={{ mt: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        Показано {from}-{to} из {safeTotal}
      </Typography>

      <TablePagination
        component="div"
        count={safeTotal}
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
        labelDisplayedRows={({ from, to, count }) => `Показано ${from}-${to} из ${count}`}
        getItemAriaLabel={(type) => {
          if (type === "next") return "Следующая страница";
          if (type === "previous") return "Предыдущая страница";
          if (type === "first") return "Первая страница";
          return "Последняя страница";
        }}
        showFirstButton
        showLastButton
      />
    </Box>
  );
};

export default PaginationControl;
