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

const AdminWebhooksPage = () => {
  return (
    <AdminSectionLayout
      title="Webhooks / Integrations"
      description="Управляйте исходящими вебхуками, секретами и доставками."
    >
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Button variant="contained">Создать webhook</Button>
        <Button variant="outlined" disabled>
          Test
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Events</TableCell>
              <TableCell>HMAC Secret</TableCell>
              <TableCell>Retry / Backoff</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6}>
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    Вебхуки ещё не настроены.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Delivery time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Attempts</TableCell>
              <TableCell>Last error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4}>
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    История доставок будет отображаться здесь.
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

export default AdminWebhooksPage;
