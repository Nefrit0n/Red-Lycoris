import { Box, Button, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";

const Dashboard = () => {
  return (
    <Box sx={{ px: { xs: 3, md: 6, xl: 8 }, py: 5 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Настройте виджеты под свою роль
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Executive overview</Typography>
                <Skeleton variant="rounded" height={24} />
                <Skeleton variant="rounded" height={24} width="80%" />
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Risk signals</Typography>
                <Skeleton variant="rounded" height={120} />
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Workload flow</Typography>
                <Skeleton variant="rounded" height={24} />
                <Skeleton variant="rounded" height={24} width="70%" />
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Card sx={{ flex: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Widgets ready to configure</Typography>
                <Skeleton variant="rounded" height={32} />
                <Skeleton variant="rounded" height={32} />
                <Skeleton variant="rounded" height={32} width="90%" />
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Quick actions</Typography>
                <Skeleton variant="rounded" height={40} />
                <Skeleton variant="rounded" height={40} width="80%" />
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Box>
          <Button variant="contained" disabled>
            Configure dashboard
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default Dashboard;
