import {
  Box,
  Button,
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

const AdminUsersPage = () => {
  return (
    <AdminSectionLayout
      title="Users"
      description="Управляйте пользователями, ролями и политикой смены паролей."
    >
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Button variant="contained">Создать пользователя</Button>
        <Button variant="outlined" disabled>
          Деактивировать
        </Button>
        <Button variant="outlined" disabled>
          Сбросить пароль
        </Button>
        <Button variant="outlined" disabled>
          Сменить роль
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username / Email</TableCell>
              <TableCell>Role (global)</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Must change password</TableCell>
              <TableCell>Created at</TableCell>
              <TableCell>Last login</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6}>
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    Нет пользователей для отображения.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </AdminSectionLayout>
  );
};

export default AdminUsersPage;
