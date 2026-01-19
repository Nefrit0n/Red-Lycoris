import {
  Box,
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
  CloudUpload as CloudUploadIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  Storage as StorageIcon,
  Inventory2 as Inventory2Icon,
} from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, isAdminUser, logout } from "../api/auth";

type RecentEntry = {
  path: string;
  title: string;
};

type NavItem = {
  label: string;
  path: string;
  icon: JSX.Element;
};

const COLLAPSED_KEY = "lotus_warden_sidebar_collapsed";
const RECENT_KEY = "lotus_warden_recent_pages";
const MAX_RECENT = 10;
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 260;

const readRecent = (): RecentEntry[] => {
  const raw = localStorage.getItem(RECENT_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRecent = (entries: RecentEntry[]) => {
  localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
};

const resolveTitleForPath = (path: string): string | null => {
  if (path.startsWith("/findings")) {
    return "Находки";
  }
  if (path.startsWith("/products")) {
    return "Продукты";
  }
  if (path.startsWith("/imports")) {
    return "Импорты";
  }
  if (path.startsWith("/scans/upload")) {
    return "Загрузить скан";
  }
  if (path.startsWith("/admin")) {
    return "Админ";
  }
  if (path.startsWith("/analyze")) {
    return "Анализ";
  }
  return null;
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const canSeeAdmin = isAdminUser(user);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw === "true";
  });
  const [recentItems, setRecentItems] = useState<RecentEntry[]>(() => readRecent());

  const navigationItems = useMemo<NavItem[]>(
    () => {
      const items: NavItem[] = [
        { label: "Находки", path: "/findings", icon: <BugReportIcon /> },
        { label: "Продукты", path: "/products", icon: <Inventory2Icon /> },
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

  useEffect(() => {
    const title = resolveTitleForPath(location.pathname);
    if (!title) {
      return;
    }

    setRecentItems((prev) => {
      const filtered = prev.filter((item) => item.path !== location.pathname);
      const updated = [{ path: location.pathname, title }, ...filtered].slice(0, MAX_RECENT);
      writeRecent(updated);
      return updated;
    });
  }, [location.pathname]);

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

        {!collapsed && recentItems.length > 0 && (
          <Box sx={{ px: 2, pt: 3 }}>
            <Typography variant="overline" color="text.secondary">
              Недавнее
            </Typography>
            <List disablePadding>
              {recentItems.map((item) => (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    my: 0.5,
                    borderRadius: 1.5,
                  }}
                >
                  <ListItemText primary={item.title} secondary={item.path} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}
      </Box>

      <Divider />

      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {!collapsed && user && (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {user.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        )}
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
