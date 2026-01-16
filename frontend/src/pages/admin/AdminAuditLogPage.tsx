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
  TextField,
  Typography,
} from "@mui/material";
import AdminSectionLayout from "../../components/AdminSectionLayout";

const AdminAuditLogPage = () => {
  return (
    <AdminSectionLayout
      title="Audit Log"
      description="История действий для расследований и контроля изменений."
    >
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Actor" fullWidth />
          <TextField label="Action" fullWidth />
          <TextField label="Entity type" fullWidth />
          <TextField label="Product" fullWidth />
          <TextField label="Период" fullWidth />
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6}>
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    Записей аудита пока нет.
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

export default AdminAuditLogPage;
