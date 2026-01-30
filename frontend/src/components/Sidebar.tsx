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
import { alpha } from "@mui/material/styles";
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
const COLLAPSED_WIDTH = 76;
const EXPANDED_WIDTH = 272;

const HEADER_H = 72;
const HEADER_SLOT = 44;

const NAV_ITEM_H = 44;

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

  // hover по ВСЕМУ сайдбару — для "лого превращается в бургер" в collapsed
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
      items.push({ label: "Админ", path: "/admin", icon: <AdminPanelSettingsIcon /> });
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
  const toggleCollapsed = () => setCollapsed((p) => !p);

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <Box
      component="aside"
      onMouseEnter={() => setIsSidebarHover(true)}
      onMouseLeave={() => setIsSidebarHover(false)}
      sx={(theme) => ({
        width,
        transition: "width 0.2s ease",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.9),

        // “pro” фон: чуть глубины + брендовый glow сверху
        bgcolor: "background.paper",
        backgroundImage: `
          radial-gradient(700px 240px at 12% 0%,
            ${alpha(theme.palette.primary.main, 0.18)} 0%,
            ${alpha(theme.palette.primary.main, 0.08)} 28%,
            transparent 60%
          ),
          radial-gradient(900px 500px at 0% 100%,
            ${alpha(theme.palette.primary.main, 0.08)} 0%,
            transparent 55%
          )
        `,
      })}
    >
      {/* HEADER */}
      <Box
        sx={(theme) => ({
          height: HEADER_H,
          px: collapsed ? 1 : 1.5,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid",
          borderBottomColor: alpha(theme.palette.divider, 0.65),
        })}
      >
        {collapsed ? (
          // COLLAPSED: логотип по центру, при hover по сайдбару превращается в бургер
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Box
              sx={{
                width: HEADER_SLOT,
                height: HEADER_SLOT,
                position: "relative",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Box
                component="img"
                src="/brand/logo.svg"
                alt="RED LYCORIS"
                sx={{
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  width: 34,
                  height: 34,
                  objectFit: "contain",
                  opacity: isSidebarHover ? 0 : 1,
                  transform: isSidebarHover ? "scale(0.92)" : "scale(1)",
                  transition: "opacity 140ms ease, transform 140ms ease",
                  userSelect: "none",
                  pointerEvents: "none",
                  filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
                }}
              />

              <IconButton
                size="small"
                onClick={toggleCollapsed}
                aria-label="Развернуть сайдбар"
                sx={(theme) => ({
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  width: HEADER_SLOT,
                  height: HEADER_SLOT,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.9),
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: "blur(6px)",
                  color: "text.primary",
                  opacity: isSidebarHover ? 1 : 0,
                  transform: isSidebarHover ? "scale(1)" : "scale(0.92)",
                  pointerEvents: isSidebarHover ? "auto" : "none",
                  transition: "opacity 140ms ease, transform 140ms ease",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.action.hover, 0.9),
                  },
                  "&.Mui-focusVisible": {
                    boxShadow: focusRing.default,
                  },
                })}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Box>
        ) : (
          // EXPANDED: logo_full занимает всё место до бургера, бургер всегда справа
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", pr: 1 }}>
              <Box
                component="img"
                src="/brand/logo_full.svg"
                alt="RED LYCORIS"
                sx={{
                  width: "100%",
                  maxWidth: 210,
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none",
                  filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.35))",
                }}
              />
            </Box>

            <IconButton
              size="small"
              onClick={toggleCollapsed}
              aria-label="Свернуть сайдбар"
              sx={(theme) => ({
                width: HEADER_SLOT,
                height: HEADER_SLOT,
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.9),
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                backdropFilter: "blur(6px)",
                color: "text.secondary",
                "&:hover": {
                  bgcolor: alpha(theme.palette.action.hover, 0.95),
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

      {/* NAV */}
      <Box
        sx={(theme) => ({
          flex: 1,
          overflowY: "auto",
          py: 1.25,

          // аккуратный скролл (не обязателен, но “проф. вид” даёт)
          "&::-webkit-scrollbar": { width: 10 },
          "&::-webkit-scrollbar-thumb": {
            background: alpha(theme.palette.text.primary, 0.12),
            borderRadius: 999,
            border: `3px solid ${alpha(theme.palette.background.paper, 0.9)}`,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: alpha(theme.palette.text.primary, 0.18),
          },
        })}
      >
        <List disablePadding sx={{ px: collapsed ? 0.75 : 1.25 }}>
          {navigationItems.map((item) => {
            const isActive = isActivePath(item.path);

            const button = (
              <ListItemButton
                key={item.path}
                onClick={() => navigate(item.path)}
                selected={isActive}
                disableRipple
                sx={(theme) => {
                  const brand = theme.palette.primary.main;

                  return {
                    height: NAV_ITEM_H,
                    minHeight: NAV_ITEM_H,
                    borderRadius: collapsed ? 2.75 : 2.5,
                    px: collapsed ? 0 : 1.5,
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: collapsed ? 0 : 1.25,
                    position: "relative",
                    overflow: "hidden",

                    // УБИВАЕМ дефолтный квадрат selected у MUI
                    "&.Mui-selected": { bgcolor: "transparent" },
                    "&.Mui-selected:hover": { bgcolor: "transparent" },

                    // Фон-hover/active через псевдо-элемент (он всегда с правильным радиусом)
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      inset: 6,
                      borderRadius: collapsed ? 18 : 16,
                      background: isActive
                        ? `linear-gradient(90deg,
                            ${alpha(brand, 0.22)} 0%,
                            ${alpha(brand, 0.10)} 35%,
                            ${alpha(brand, 0.04)} 100%
                          )`
                        : "transparent",
                      boxShadow: isActive
                        ? `0 0 0 1px ${alpha(brand, 0.18)}, 0 10px 28px ${alpha(brand, 0.14)}`
                        : "none",
                      transition: "all 160ms ease",
                      zIndex: 0,
                    },

                    "&:hover::after": {
                      background: isActive
                        ? `linear-gradient(90deg,
                            ${alpha(brand, 0.26)} 0%,
                            ${alpha(brand, 0.12)} 38%,
                            ${alpha(brand, 0.06)} 100%
                          )`
                        : alpha(theme.palette.action.hover, 0.9),
                      boxShadow: isActive
                        ? `0 0 0 1px ${alpha(brand, 0.22)}, 0 12px 32px ${alpha(brand, 0.18)}`
                        : `0 0 0 1px ${alpha(theme.palette.divider, 0.55)}`,
                    },

                    // Брендовый индикатор активного пункта — тонкий бар слева (и в collapsed тоже норм)
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: collapsed ? 6 : 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: isActive ? 22 : 10,
                      borderRadius: 999,
                      backgroundColor: isActive ? brand : "transparent",
                      boxShadow: isActive ? `0 0 0 5px ${alpha(brand, 0.10)}` : "none",
                      transition: "all 160ms ease",
                      zIndex: 1,
                    },

                    // Фокус
                    "&.Mui-focusVisible": {
                      boxShadow: focusRing.default,
                    },
                  };
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 1.5,
                    color: isActive ? "primary.main" : "text.secondary",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 2,
                    "& svg": { fontSize: 22 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>

                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: 650,
                      fontSize: 14,
                      letterSpacing: 0.2,
                    }}
                    sx={{ position: "relative", zIndex: 2 }}
                  />
                )}
              </ListItemButton>
            );

            return collapsed ? (
              <Tooltip key={item.path} title={item.label} placement="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </List>
      </Box>

      {/* FOOTER */}
      <Box sx={{ px: collapsed ? 1 : 1.5, py: 1.25 }}>
        <Divider sx={{ mb: 1.25 }} />

        {/* Quick search */}
        {onOpenCommandPalette && (
          <Tooltip title={collapsed ? "Поиск (⌘K)" : ""} placement="right">
            {collapsed ? (
              <IconButton
                onClick={onOpenCommandPalette}
                aria-label="Поиск"
                sx={(theme) => ({
                  width: HEADER_SLOT,
                  height: HEADER_SLOT,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.85),
                  color: "text.secondary",
                  "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.95) },
                  "&.Mui-focusVisible": { boxShadow: focusRing.subtle },
                })}
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
            disableRipple
            sx={(theme) => ({
              mt: 1,
              height: 44,
              borderRadius: 2.75,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 0 : 1.5,
              position: "relative",
              overflow: "hidden",
              "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.95) },
              "&.Mui-focusVisible": { boxShadow: focusRing.subtle },
            })}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 1.5,
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

        {!collapsed && (
          <Box
            sx={(theme) => ({
              mt: 1.25,
              px: 1,
              py: 1,
              borderRadius: 2.5,
              border: "1px solid",
              borderColor: alpha(theme.palette.divider, 0.85),
              display: "flex",
              alignItems: "center",
              gap: 1,
              background: alpha(theme.palette.background.paper, 0.55),
              backdropFilter: "blur(6px)",
            })}
          >
            <Avatar sx={{ width: 30, height: 30, fontSize: "0.75rem" }}>
              {(user?.username ?? "root").slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: 13,
                  fontWeight: 800,
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

        <Tooltip title="Выйти" placement="right" disableHoverListener={!collapsed}>
          <ListItemButton
            onClick={handleLogout}
            disableRipple
            sx={(theme) => ({
              mt: 1,
              height: 44,
              borderRadius: 2.75,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 0 : 1.5,
              "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.95) },
              "&.Mui-focusVisible": { boxShadow: focusRing.subtle },
            })}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 1.5,
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
