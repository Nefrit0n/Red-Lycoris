import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AdminSectionLayout from "../../components/AdminSectionLayout";

const AdminGroupsPage = () => {
  return (
    <AdminSectionLayout
      title="Groups + Product Access"
      description="Группы и матрица доступа к продуктам для масштабируемого управления правами."
    >
      <Stack spacing={3}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell># Users</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3}>
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography color="text.secondary">
                      Группы ещё не созданы.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Матрица доступа (группа / пользователь → продукт → роль)
          </Typography>
          <Typography color="text.secondary">
            Здесь будет отображаться матрица membership и ролей
            (viewer/maintainer/owner) для каждого продукта.
          </Typography>
        </Paper>
      </Stack>
    </AdminSectionLayout>
  );
};

export default AdminGroupsPage;
