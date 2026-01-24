import {
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AdminPanelSettings as AdminPanelSettingsIcon,
  BugReport as BugReportIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as CloudUploadIcon,
  Dashboard as DashboardIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  Search as SearchIcon,
  Storage as StorageIcon,
  Inventory2 as Inventory2Icon,
} from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, isAdminUser, logout } from "../api/auth";
import { useThemeMode } from "../contexts/ThemeContext";

type NavItem = {
  label: string;
  path: string;
  icon: JSX.Element;
};

const COLLAPSED_KEY = "lotus_warden_sidebar_collapsed";
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 260;

interface SidebarProps {
  onOpenCommandPalette?: () => void;
}

const Sidebar = ({ onOpenCommandPalette }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const canSeeAdmin = isAdminUser(user);
  const { resolvedMode, toggleMode } = useThemeMode();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw === "true";
  });

  const navigationItems = useMemo<NavItem[]>(
    () => {
      const items: NavItem[] = [
        { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
        { label: "Находки", path: "/findings", icon: <BugReportIcon /> },
        { label: "Продукты", path: "/products", icon: <Inventory2Icon /> },
        { label: "Анализ", path: "/analyze", icon: <AnalyticsIcon /> },
        { label: "Импорты", path: "/imports", icon: <StorageIcon /> },
        { label: "Загрузить скан", path: "/scans/upload", icon: <CloudUploadIcon /> },
      ];
      if (canSeeAdmin) {
        items.push({
          label: "Админ",
          path: "/admin",
          icon: <AdminPanelSettingsIcon />,
        });
      }
      return items;
    },
    [canSeeAdmin]
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box
      component="aside"
      sx={{
        width,
        transition: "width 0.2s ease",
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 1,
        }}
      >
        {!collapsed && (
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Lotus Warden
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Управление находками уязвимостей
            </Typography>
          </Box>
        )}
        <IconButton
          size="small"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
          sx={{ color: "text.secondary" }}
        >
          {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <Box sx={{ px: collapsed ? 0 : 2, pt: 2 }}>
          {!collapsed && (
            <Typography variant="overline" color="text.secondary">
              Навигация
            </Typography>
          )}
          <List disablePadding>
            {navigationItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);

              const content = (
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={{
                    mx: collapsed ? 0.5 : 0,
                    my: 0.5,
                    borderRadius: 1.5,
                    justifyContent: collapsed ? "center" : "flex-start",
                    px: collapsed ? 1 : 2,
                    "&.Mui-selected": {
                      bgcolor: "rgba(122, 162, 247, 0.18)",
                      "&:hover": {
                        bgcolor: "rgba(122, 162, 247, 0.24)",
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: collapsed ? 0 : 2,
                      color: isActive ? "primary.main" : "text.secondary",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
                  )}
                </ListItemButton>
              );

              return collapsed ? (
                <Tooltip key={item.path} title={item.label} placement="right">
                  {content}
                </Tooltip>
              ) : (
                content
              );
            })}
          </List>
        </Box>
      </Box>

      <Divider />

      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {/* Search Button */}
        {onOpenCommandPalette && (
          <Tooltip title={collapsed ? "Поиск (⌘K)" : ""} placement="right">
            <ListItemButton
              onClick={onOpenCommandPalette}
              sx={{
                borderRadius: 1.5,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1 : 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: collapsed ? 0 : 1.5,
                  color: "text.secondary",
                  justifyContent: "center",
                }}
              >
                <SearchIcon fontSize="small" />
              </ListItemIcon>
              {!collapsed && (
                <>
                  <ListItemText
                    primary="Поиск"
                    primaryTypographyProps={{ fontSize: "0.875rem" }}
                  />
                  <Chip label="⌘K" size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                </>
              )}
            </ListItemButton>
          </Tooltip>
        )}

        {/* Theme Toggle */}
        <Tooltip
          title={collapsed ? (resolvedMode === "dark" ? "Светлая тема" : "Тёмная тема") : ""}
          placement="right"
        >
          <ListItemButton
            onClick={toggleMode}
            sx={{
              borderRadius: 1.5,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 2,
                color: "text.secondary",
                justifyContent: "center",
              }}
            >
              {resolvedMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </ListItemIcon>
            {!collapsed && (
              <ListItemText primary={resolvedMode === "dark" ? "Светлая тема" : "Тёмная тема"} />
            )}
          </ListItemButton>
        </Tooltip>

        <Divider sx={{ my: 0.5 }} />

        {/* User Info */}
        {!collapsed && user && (
          <Box sx={{ px: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {user.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        )}

        {/* Logout */}
        <Tooltip title="Выйти" placement="right" disableHoverListener={!collapsed}>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 1.5,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 2,
                color: "text.secondary",
                justifyContent: "center",
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Выйти" />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default Sidebar;
