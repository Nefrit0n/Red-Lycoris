import {
  Box,
  Dialog,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DashboardIcon from "@mui/icons-material/Dashboard";
import BugReportIcon from "@mui/icons-material/BugReport";
import InventoryIcon from "@mui/icons-material/Inventory";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import SecurityIcon from "@mui/icons-material/Security";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactElement;
  action: () => void;
  category: "navigation" | "action" | "search";
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define all available commands
  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        title: "Dashboard",
        subtitle: "Главная страница с метриками",
        icon: <DashboardIcon />,
        action: () => navigate("/dashboard"),
        category: "navigation",
        keywords: ["главная", "home", "метрики", "обзор"],
      },
      {
        id: "nav-findings",
        title: "Findings",
        subtitle: "Список всех находок",
        icon: <BugReportIcon />,
        action: () => navigate("/findings"),
        category: "navigation",
        keywords: ["находки", "уязвимости", "vulnerabilities"],
      },
      {
        id: "nav-findings-critical",
        title: "Critical Findings",
        subtitle: "Только критические находки",
        icon: <BugReportIcon color="error" />,
        action: () => navigate("/findings?severity=critical"),
        category: "navigation",
        keywords: ["критические", "critical", "важные"],
      },
      {
        id: "nav-products",
        title: "Products",
        subtitle: "Список продуктов",
        icon: <InventoryIcon />,
        action: () => navigate("/products"),
        category: "navigation",
        keywords: ["продукты", "inventory", "приложения"],
      },
      {
        id: "nav-upload",
        title: "Upload Scan",
        subtitle: "Загрузить отчёт сканера",
        icon: <UploadFileIcon />,
        action: () => navigate("/scans/upload"),
        category: "navigation",
        keywords: ["загрузить", "upload", "скан", "отчёт"],
      },
      {
        id: "nav-imports",
        title: "Import History",
        subtitle: "История импортов",
        icon: <HistoryIcon />,
        action: () => navigate("/imports"),
        category: "navigation",
        keywords: ["импорт", "история", "history"],
      },
      {
        id: "nav-analyze",
        title: "Analysis Jobs",
        subtitle: "Задачи анализа",
        icon: <AnalyticsIcon />,
        action: () => navigate("/analyze"),
        category: "navigation",
        keywords: ["анализ", "jobs", "задачи"],
      },
      {
        id: "nav-admin",
        title: "Admin Panel",
        subtitle: "Настройки системы",
        icon: <SettingsIcon />,
        action: () => navigate("/admin"),
        category: "navigation",
        keywords: ["админ", "настройки", "settings"],
      },
      {
        id: "nav-users",
        title: "Users Management",
        subtitle: "Управление пользователями",
        icon: <PeopleIcon />,
        action: () => navigate("/admin/users"),
        category: "navigation",
        keywords: ["пользователи", "users", "управление"],
      },
      {
        id: "nav-scanners",
        title: "Scanners Configuration",
        subtitle: "Настройка сканеров",
        icon: <SecurityIcon />,
        action: () => navigate("/admin/scanners"),
        category: "navigation",
        keywords: ["сканеры", "scanners", "конфигурация"],
      },
      // Actions
      {
        id: "action-new-finding",
        title: "View New Findings",
        subtitle: "Показать новые находки",
        icon: <BugReportIcon color="primary" />,
        action: () => navigate("/findings?status=new"),
        category: "action",
        keywords: ["новые", "new", "непросмотренные"],
      },
      {
        id: "action-my-findings",
        title: "My Assigned Findings",
        subtitle: "Назначенные мне находки",
        icon: <BugReportIcon color="secondary" />,
        action: () => navigate("/findings?assigned=me"),
        category: "action",
        keywords: ["мои", "assigned", "назначенные"],
      },
    ],
    [navigate]
  );

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(lowerQuery);
      const subtitleMatch = cmd.subtitle?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((kw) =>
        kw.toLowerCase().includes(lowerQuery)
      );
      return titleMatch || subtitleMatch || keywordMatch;
    });
  }, [commands, query]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      search: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = filteredCommands.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  const handleItemClick = (cmd: CommandItem) => {
    cmd.action();
    onClose();
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "navigation":
        return "Навигация";
      case "action":
        return "Действия";
      case "search":
        return "Поиск";
      default:
        return category;
    }
  };

  let itemIndex = -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: "background.paper",
          backgroundImage: "none",
          maxHeight: "70vh",
          overflow: "hidden",
        },
      }}
      sx={{
        "& .MuiBackdrop-root": {
          backdropFilter: "blur(4px)",
        },
      }}
    >
      {/* Search Input */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <SearchIcon sx={{ color: "text.secondary", mr: 1.5 }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Поиск команд и страниц..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ fontSize: "1rem" }}
        />
        <Chip
          label="ESC"
          size="small"
          variant="outlined"
          sx={{ ml: 1, fontSize: "0.65rem", height: 20 }}
        />
      </Box>

      {/* Results */}
      <Box sx={{ overflow: "auto", maxHeight: "calc(70vh - 60px)" }}>
        {filteredCommands.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">
              Ничего не найдено для "{query}"
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 1 }}>
            {(["navigation", "action", "search"] as const).map((category) => {
              const items = groupedCommands[category];
              if (items.length === 0) return null;

              return (
                <Box key={category}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, py: 0.5, display: "block" }}
                  >
                    {getCategoryLabel(category)}
                  </Typography>
                  {items.map((cmd) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <ListItem key={cmd.id} disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => handleItemClick(cmd)}
                          sx={{
                            py: 1,
                            px: 2,
                            "&.Mui-selected": {
                              bgcolor: "action.selected",
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {cmd.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={cmd.title}
                            secondary={cmd.subtitle}
                            primaryTypographyProps={{ fontWeight: 500 }}
                            secondaryTypographyProps={{ fontSize: "0.75rem" }}
                          />
                          {isSelected && (
                            <KeyboardReturnIcon
                              sx={{ color: "text.secondary", fontSize: 18 }}
                            />
                          )}
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </Box>
              );
            })}
          </List>
        )}
      </Box>

      {/* Footer hint */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 2,
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          <Chip label="↑↓" size="small" sx={{ mr: 0.5, height: 18, fontSize: "0.6rem" }} />
          навигация
        </Typography>
        <Typography variant="caption" color="text.secondary">
          <Chip label="↵" size="small" sx={{ mr: 0.5, height: 18, fontSize: "0.6rem" }} />
          выбрать
        </Typography>
        <Typography variant="caption" color="text.secondary">
          <Chip label="esc" size="small" sx={{ mr: 0.5, height: 18, fontSize: "0.6rem" }} />
          закрыть
        </Typography>
      </Box>
    </Dialog>
  );
};

export default CommandPalette;
