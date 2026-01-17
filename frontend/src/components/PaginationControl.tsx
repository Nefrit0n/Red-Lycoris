import { Box, TablePagination, Typography } from "@mui/material";

interface PaginationControlProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PaginationControl = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlProps) => {
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
        Показано {Math.min((page + 1) * pageSize, total)} из {total} результатов
      </Typography>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, nextPage) => onPageChange(nextPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(event) =>
          onPageSizeChange(Number(event.target.value))
        }
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Строк на странице"
        labelDisplayedRows={({ from, to, count }) =>
          `Показано ${from}-${to} из ${count}`
        }
        getItemAriaLabel={(type) => {
          if (type === "next") {
            return "Следующая страница";
          }
          if (type === "previous") {
            return "Предыдущая страница";
          }
          if (type === "first") {
            return "Первая страница";
          }
          return "Последняя страница";
        }}
      />
    </Box>
  );
};

export default PaginationControl;
