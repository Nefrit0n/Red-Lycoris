import {
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
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
import { focusRing } from "../design-system/tokens";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

const COLLAPSED_KEY = "red_lycoris_sidebar_collapsed";
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 260;

const HEADER_H = 68; // высота зоны логотипа/бургера

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

  // hover по ВСЕМУ сайдбару — нужно для "лого превращается в бургер" в collapsed
  const [isSidebarHover, setIsSidebarHover] = useState(false);

  const navigationItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: "Дашборд", path: "/dashboard", icon: <DashboardIcon /> },
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
  }, [canSeeAdmin]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <Box
      component="aside"
      onMouseEnter={() => setIsSidebarHover(true)}
      onMouseLeave={() => setIsSidebarHover(false)}
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
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          height: HEADER_H,
          px: collapsed ? 1 : 1.5,
          display: "flex",
          alignItems: "center",
        }}
      >
        {collapsed ? (
          // COLLAPSED: логотип по центру, при hover по сайдбару превращается в бургер
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Box
              component="img"
              src="/brand/logo.svg"
              alt="RED LYCORIS"
              sx={{
                width: 32,
                height: 32,
                objectFit: "contain",
                opacity: isSidebarHover ? 0 : 1,
                transform: isSidebarHover ? "scale(0.92)" : "scale(1)",
                transition: "opacity 140ms ease, transform 140ms ease",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />

            <IconButton
              size="small"
              onClick={toggleCollapsed}
              aria-label="Развернуть сайдбар"
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: 2,
                border: "1px solid",
                borderColor: theme.palette.divider,
                bgcolor: theme.palette.action.hover,
                color: "text.primary",
                opacity: isSidebarHover ? 1 : 0,
                transform: isSidebarHover ? "scale(1)" : "scale(0.92)",
                pointerEvents: isSidebarHover ? "auto" : "none",
                transition: "opacity 140ms ease, transform 140ms ease",
                "&:hover": {
                  bgcolor: theme.palette.action.selected,
                },
                "&.Mui-focusVisible": {
                  boxShadow: focusRing.default,
                },
              })}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        ) : (
          // EXPANDED: логотип занимает всё место до бургера, бургер всегда видим справа
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                alignItems: "center",
                pr: 1,
              }}
            >
              <Box
                component="img"
                src="/brand/logo_full.svg"
                alt="RED LYCORIS"
                sx={{
                  height: 24,
                  width: "100%",
                  maxWidth: 190,
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none",
                }}
              />
            </Box>

            <IconButton
              size="small"
              onClick={toggleCollapsed}
              aria-label="Свернуть сайдбар"
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: 2,
                border: "1px solid",
                borderColor: theme.palette.divider,
                bgcolor: theme.palette.background.paper,
                color: "text.secondary",
                "&:hover": {
                  bgcolor: theme.palette.action.hover,
                  color: "text.primary",
                },
                "&.Mui-focusVisible": {
                  boxShadow: focusRing.default,
                },
              })}
            >
              <MenuOpenIcon />
            </IconButton>
          </Box>
        )}
      </Box>

      <Divider />

      {/* NAV */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <Box sx={{ px: collapsed ? 0 : 2, pt: 2 }}>
          <List disablePadding>
            {navigationItems.map((item) => {
              const isActive = isActivePath(item.path);

              const content = (
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={(theme) => ({
                    mx: collapsed ? 0.75 : 0,
                    my: 0.5,
                    borderRadius: 1.5,
                    justifyContent: collapsed ? "center" : "flex-start",
                    px: collapsed ? 1 : 2,
                    minHeight: 42,
                    position: "relative",

                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: collapsed ? "50%" : 8,
                      top: "50%",
                      transform: collapsed ? "translate(-50%, -50%)" : "translateY(-50%)",
                      width: collapsed ? 6 : 3,
                      height: collapsed ? 6 : "62%",
                      borderRadius: 999,
                      backgroundColor: isActive ? theme.palette.primary.main : "transparent",
                      transition: "all 0.2s ease",
                    },

                    "&.Mui-selected": {
                      bgcolor: theme.palette.action.selected,
                      "&:hover": {
                        bgcolor: theme.palette.action.hover,
                      },
                    },
                    "&:hover": {
                      bgcolor: theme.palette.action.hover,
                    },
                    "&.Mui-focusVisible": {
                      boxShadow: focusRing.default,
                    },
                  })}
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
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
                  )}
                </ListItemButton>
              );

              return collapsed ? (
                <Tooltip key={item.path} title={item.label} placement="right">
                  {content}
                </Tooltip>
              ) : (
                <Box key={item.path}>{content}</Box>
              );
            })}
          </List>
        </Box>
      </Box>

      <Divider />

      {/* FOOTER */}
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {/* Quick search */}
        {onOpenCommandPalette && (
          <Tooltip title={collapsed ? "Поиск (⌘K)" : ""} placement="right">
            {collapsed ? (
              <IconButton
                onClick={onOpenCommandPalette}
                sx={(theme) => ({
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: theme.palette.divider,
                  color: "text.secondary",
                  "&:hover": { bgcolor: theme.palette.action.hover },
                })}
                aria-label="Поиск"
              >
                <SearchIcon fontSize="small" />
              </IconButton>
            ) : (
              <TextField
                size="small"
                placeholder="Поиск"
                onClick={onOpenCommandPalette}
                fullWidth
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Chip label="⌘K" size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
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
              minHeight: 40,
              "&.Mui-focusVisible": {
                boxShadow: focusRing.subtle,
              },
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
        {!collapsed && (
          <Box
            sx={{
              px: 1,
              py: 1,
              borderRadius: 1.5,
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem" }}>
              {(user?.username ?? "root").slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.username ?? "root"}
              </Box>
              <Box
                sx={{
                  fontSize: 12,
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.email ?? "Security Admin"}
              </Box>
            </Box>
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
              minHeight: 40,
              "&.Mui-focusVisible": {
                boxShadow: focusRing.subtle,
              },
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
