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
  Typography,
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
  group: "main" | "ops" | "system";
};

const COLLAPSED_KEY = "red_lycoris_sidebar_collapsed";
const COLLAPSED_WIDTH = 76;
const EXPANDED_WIDTH = 280;

const HEADER_H = 72;
const HEADER_SLOT = 44;

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

  // hover по ВСЕМУ сайдбару — нужно для “лого превращается в бургер” в collapsed
  const [isSidebarHover, setIsSidebarHover] = useState(false);

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

  const navigationItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: "Дашборд", path: "/dashboard", icon: <DashboardIcon />, group: "main" },
      { label: "Находки", path: "/findings", icon: <BugReportIcon />, group: "main" },
      { label: "Продукты", path: "/products", icon: <Inventory2Icon />, group: "main" },

      { label: "Анализ", path: "/analyze", icon: <AnalyticsIcon />, group: "ops" },
      { label: "Импорты", path: "/imports", icon: <StorageIcon />, group: "ops" },
      { label: "Загрузить скан", path: "/scans/upload", icon: <CloudUploadIcon />, group: "ops" },
    ];

    if (canSeeAdmin) {
      items.push({
        label: "Админ",
        path: "/admin",
        icon: <AdminPanelSettingsIcon />,
        group: "system",
      });
    }

    return items;
  }, [canSeeAdmin]);

  const groups = useMemo(() => {
    const main = navigationItems.filter((x) => x.group === "main");
    const ops = navigationItems.filter((x) => x.group === "ops");
    const system = navigationItems.filter((x) => x.group === "system");
    return { main, ops, system };
  }, [navigationItems]);

  return (
    <Box
      component="aside"
      onMouseEnter={() => setIsSidebarHover(true)}
      onMouseLeave={() => setIsSidebarHover(false)}
      sx={(theme) => {
        const brand = theme.palette.primary.main;

        return {
          width,
          transition: "width 180ms ease",
          height: "100vh",
          position: "sticky",
          top: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",

          // “дорогой” фон: лёгкий градиент + тонкий бордер
          background: `linear-gradient(180deg,
            ${alpha(brand, theme.palette.mode === "dark" ? 0.10 : 0.06)} 0%,
            ${alpha(theme.palette.background.paper, 1)} 24%,
            ${alpha(theme.palette.background.paper, 1)} 100%
          )`,
          borderRight: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.8 : 1)}`,

          // брендовая вертикальная “рейка” слева (очень тонкая, но добавляет характер)
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: `linear-gradient(180deg, ${alpha(brand, 0.85)}, ${alpha(brand, 0)})`,
            opacity: theme.palette.mode === "dark" ? 0.7 : 0.5,
            pointerEvents: "none",
          },
        };
      }}
    >
      {/* HEADER */}
      <Box
        sx={(theme) => ({
          height: HEADER_H,
          px: collapsed ? 1 : 1.5,
          display: "flex",
          alignItems: "center",
          position: "relative",

          // нижняя линия — как “app chrome”
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        })}
      >
        {collapsed ? (
          // COLLAPSED: лого по центру, при hover по сайдбару превращается в бургер
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
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
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.9),
                  background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(
                    theme.palette.background.paper,
                    0.6
                  )})`,
                  backdropFilter: "blur(10px)",
                  color: "text.primary",
                  opacity: isSidebarHover ? 1 : 0,
                  transform: isSidebarHover ? "scale(1)" : "scale(0.92)",
                  pointerEvents: isSidebarHover ? "auto" : "none",
                  transition: "opacity 140ms ease, transform 140ms ease",
                  boxShadow: `0 10px 22px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.35 : 0.12)}`,
                  "&:hover": {
                    background: alpha(theme.palette.background.paper, 0.95),
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
          // EXPANDED: logo_full занимает всё место до бургера, бургер всегда видим справа
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 1 }}>
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
                  width: "100%",
                  maxWidth: 210,
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
                width: HEADER_SLOT,
                height: HEADER_SLOT,
                borderRadius: 2,
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.9),
                background: alpha(theme.palette.background.paper, 0.55),
                backdropFilter: "blur(10px)",
                color: "text.secondary",
                "&:hover": {
                  background: alpha(theme.palette.background.paper, 0.8),
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
      <Box sx={{ flex: 1, overflowY: "auto", py: 1.5 }}>
        <NavGroup
          title="Навигация"
          collapsed={collapsed}
          items={groups.main}
          isActivePath={isActivePath}
          onNavigate={(p) => navigate(p)}
        />
        <NavGroup
          title="Операции"
          collapsed={collapsed}
          items={groups.ops}
          isActivePath={isActivePath}
          onNavigate={(p) => navigate(p)}
        />
        {groups.system.length > 0 && (
          <NavGroup
            title="Система"
            collapsed={collapsed}
            items={groups.system}
            isActivePath={isActivePath}
            onNavigate={(p) => navigate(p)}
          />
        )}
      </Box>

      {/* FOOTER */}
      <Box
        sx={(theme) => ({
          px: collapsed ? 1 : 2,
          py: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0)} 0%, ${alpha(
            theme.palette.background.paper,
            1
          )} 28%)`,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        })}
      >
        {/* Quick search */}
        {onOpenCommandPalette && (
          <Tooltip title={collapsed ? "Поиск (⌘K)" : ""} placement="right">
            {collapsed ? (
              <IconButton
                onClick={onOpenCommandPalette}
                sx={(theme) => ({
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.9),
                  color: "text.secondary",
                  "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.7), color: "text.primary" },
                  "&.Mui-focusVisible": { boxShadow: focusRing.subtle },
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
                sx={(theme) => ({
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    background: alpha(theme.palette.background.paper, 0.55),
                    backdropFilter: "blur(10px)",
                  },
                })}
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
            sx={(theme) => ({
              borderRadius: 2,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 1.5,
              minHeight: 42,
              border: `1px solid ${alpha(theme.palette.divider, 0.0)}`,
              "&:hover": {
                bgcolor: alpha(theme.palette.action.hover, 0.7),
              },
              "&.Mui-focusVisible": {
                boxShadow: focusRing.subtle,
              },
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
            {!collapsed && <ListItemText primary={resolvedMode === "dark" ? "Светлая тема" : "Тёмная тема"} />}
          </ListItemButton>
        </Tooltip>

        <Divider sx={{ my: 0.5 }} />

        {/* User Info */}
        {!collapsed && (
          <Box
            sx={(theme) => ({
              px: 1,
              py: 1,
              borderRadius: 2,
              border: "1px solid",
              borderColor: alpha(theme.palette.divider, 0.9),
              background: alpha(theme.palette.background.paper, 0.55),
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: 1,
            })}
          >
            <Avatar sx={{ width: 30, height: 30, fontSize: "0.75rem" }}>
              {(user?.username ?? "root").slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
                {user?.username ?? "root"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email ?? "Security Admin"}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Logout */}
        <Tooltip title="Выйти" placement="right" disableHoverListener={!collapsed}>
          <ListItemButton
            onClick={handleLogout}
            sx={(theme) => ({
              borderRadius: 2,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 1.5,
              minHeight: 42,
              "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.7) },
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

function NavGroup({
  title,
  collapsed,
  items,
  isActivePath,
  onNavigate,
}: {
  title: string;
  collapsed: boolean;
  items: NavItem[];
  isActivePath: (p: string) => boolean;
  onNavigate: (p: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Box sx={{ px: collapsed ? 0 : 2, mb: 1.5 }}>
      {!collapsed && (
        <Typography
          variant="overline"
          sx={(theme) => ({
            display: "block",
            px: 1,
            mb: 0.75,
            color: alpha(theme.palette.text.secondary, 0.9),
            letterSpacing: "0.12em",
          })}
        >
          {title}
        </Typography>
      )}

      <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {items.map((item) => {
          const active = isActivePath(item.path);

          const button = (
            <ListItemButton
              key={item.path}
              onClick={() => onNavigate(item.path)}
              selected={active}
              aria-current={active ? "page" : undefined}
              sx={(theme) => {
                const brand = theme.palette.primary.main;
                const activeBg = alpha(brand, theme.palette.mode === "dark" ? 0.14 : 0.10);
                const hoverBg = alpha(theme.palette.action.hover, theme.palette.mode === "dark" ? 0.55 : 0.65);

                return {
                  mx: collapsed ? 0.9 : 0,
                  borderRadius: 2,
                  minHeight: 46,
                  px: collapsed ? 1 : 1.5,
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative",
                  overflow: "hidden",
                  transition: "background 140ms ease, transform 140ms ease",

                  // мягкий “glow” у активного
                  ...(active && {
                    background: `linear-gradient(90deg, ${activeBg}, ${alpha(theme.palette.background.paper, 0.0)})`,
                    border: `1px solid ${alpha(brand, theme.palette.mode === "dark" ? 0.30 : 0.22)}`,
                    boxShadow: `0 10px 22px ${alpha(brand, theme.palette.mode === "dark" ? 0.18 : 0.10)}`,
                  }),

                  "&:hover": {
                    backgroundColor: active ? alpha(brand, 0.18) : hoverBg,
                    transform: collapsed ? "translateY(-1px)" : "translateY(-1px)",
                  },

                  "&.Mui-focusVisible": {
                    boxShadow: focusRing.default,
                  },

                  // Индикатор (слева в expanded, точка в collapsed)
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: collapsed ? "50%" : 10,
                    top: collapsed ? 6 : "50%",
                    transform: collapsed ? "translateX(-50%)" : "translateY(-50%)",
                    width: collapsed ? 8 : 3,
                    height: collapsed ? 8 : "62%",
                    borderRadius: 999,
                    backgroundColor: active ? brand : "transparent",
                    opacity: active ? 1 : 0,
                    transition: "opacity 140ms ease",
                  },
                };
              }}
            >
              <ListItemIcon
                sx={(theme) => ({
                  minWidth: 0,
                  mr: collapsed ? 0 : 1.5,
                  justifyContent: "center",
                  color: active ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.95),
                  "& svg": { fontSize: 22 },
                })}
              >
                {item.icon}
              </ListItemIcon>

              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: active ? 800 : 650,
                    fontSize: 14,
                  }}
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
  );
}

export default Sidebar;
