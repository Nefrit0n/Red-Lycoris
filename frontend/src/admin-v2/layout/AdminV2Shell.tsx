import {
  Avatar,
  Box,
  Breadcrumbs,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { adminV2Routes, adminV2RouteMap } from "../routes";
import { GlassCard } from "../../design-system/components/GlassCard";
import { Button } from "../../design-system/components/Button";
import { space } from "../../design-system/tokens";

interface AdminV2ShellProps {
  title: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
  };
  children: React.ReactNode;
}

const AdminV2Shell = ({ title, primaryAction, children }: AdminV2ShellProps) => {
  const location = useLocation();
  const currentRoute = adminV2RouteMap.get(location.pathname);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
        minHeight: "100vh",
        backgroundColor: "background.default",
      }}
    >
      <Box
        component="aside"
        sx={{
          borderRight: { md: "1px solid" },
          borderColor: { md: "divider" },
          px: { xs: 2, md: 3 },
          py: 3,
          backgroundColor: { xs: "transparent", md: "background.paper" },
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>А</Avatar>
            <Box>
              <Typography fontWeight={700}>Админ-консоль</Typography>
              <Typography variant="caption" color="text.secondary">
                Управление доступом
              </Typography>
            </Box>
          </Stack>

          <Divider />

          <List sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {adminV2Routes.map((route) => {
              const Icon = route.icon;
              const isActive = location.pathname === route.path;
              return (
                <ListItemButton
                  key={route.path}
                  component={Link}
                  to={route.path}
                  selected={isActive}
                  sx={{
                    borderRadius: 2,
                    "&.Mui-selected": {
                      backgroundColor: "action.selected",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={route.label}
                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Stack>
      </Box>

      <Box component="main" sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Breadcrumbs aria-label="breadcrumb">
              <Typography color="text.secondary">Администрирование</Typography>
              {currentRoute && currentRoute.path !== "/admin" && (
                <Typography color="text.primary">{currentRoute.title}</Typography>
              )}
            </Breadcrumbs>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="h4" fontWeight={700}>
                {title}
              </Typography>
              {primaryAction && (
                <Button variant="glow" color="lotus" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              )}
            </Stack>
          </Stack>

          <GlassCard
            variant="subtle"
            sx={{
              padding: space[6],
              minHeight: "70vh",
            }}
          >
            {children}
          </GlassCard>
        </Stack>
      </Box>
    </Box>
  );
};

export default AdminV2Shell;
