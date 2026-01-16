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

const AdminScannersPage = () => {
  return (
    <AdminSectionLayout
      title="Scanners / Mappings"
      description="Настройка сопоставлений для данных сканеров."
    >
      <Stack spacing={3}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Scanner</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3}>
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography color="text.secondary">
                      Список сканеров будет доступен после первого импорта.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Severity mapping
          </Typography>
          <Typography color="text.secondary">
            Здесь настраивается сопоставление severity сканера с внутренней
            шкалой критичности.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Status mapping
          </Typography>
          <Typography color="text.secondary">
            Сопоставление статусов сканера с внутренними статусами (если
            применимо).
          </Typography>
        </Paper>
      </Stack>
    </AdminSectionLayout>
  );
};

export default AdminScannersPage;
