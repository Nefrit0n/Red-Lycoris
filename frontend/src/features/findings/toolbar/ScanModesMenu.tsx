import {
  Badge,
  Box,
  Button,
  Checkbox,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { useMemo, useRef, useState } from "react";
import { FiltersState } from "../../filters/types";
import { CATEGORY_LABELS } from "../../filters/labels";
import { primitives } from "../../../design-system/tokens/colors";

interface ScanModesMenuProps {
  value: FiltersState["categories"];
  onChange: (next: FiltersState["categories"]) => void;
  options: Array<{ category: string; count?: number }>;
}

const fallbackCategories = ["SAST", "SCA", "DAST", "SECRETS", "CONTAINER", "IAC"];

const ScanModesMenu = ({ value, onChange, options }: ScanModesMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const resolvedOptions = useMemo(() => {
    const base = options.length ? options.map((item) => item.category) : fallbackCategories;
    return Array.from(new Set(base));
  }, [options]);

  const labelMap = useMemo(
    () => ({
      ...CATEGORY_LABELS,
      CONTAINER: "Контейнеры",
    }),
    []
  );

  const summary = useMemo(() => {
    if (!value.length) {
      return "Виды сканирования: Все";
    }
    const labels = value.map((item) => labelMap[item as keyof typeof labelMap] ?? item);
    const visible = labels.slice(0, 2);
    const hidden = labels.length - visible.length;
    return `Виды сканирования: ${visible.join(", ")}${hidden > 0 ? ` +${hidden}` : ""}`;
  }, [labelMap, value]);

  const handleToggle = (nextValue: string) => {
    if (value.includes(nextValue)) {
      onChange(value.filter((item) => item !== nextValue));
    } else {
      onChange([...value, nextValue]);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    buttonRef.current?.focus();
  };

  return (
    <Box>
      <Badge
        badgeContent={value.length}
        color="error"
        invisible={value.length === 0}
        sx={{
          "& .MuiBadge-badge": {
            bgcolor: primitives.lotus[500],
            color: primitives.night[50],
          },
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<CategoryOutlinedIcon />}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="Открыть меню видов сканирования"
          sx={{
            height: 34,
            borderRadius: "999px",
            borderColor: primitives.night[600],
            color: primitives.night[100],
            "&:hover": { borderColor: primitives.lotus[400], color: primitives.lotus[400] },
            textTransform: "none",
            px: 1.5,
            gap: 0.5,
          }}
          ref={buttonRef}
        >
          {summary}
        </Button>
      </Badge>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            width: 240,
            bgcolor: primitives.night[800],
            color: primitives.night[50],
            border: `1px solid ${primitives.night[600]}`,
          },
        }}
        MenuListProps={{
          dense: true,
          disablePadding: true,
          disableAutoFocusItem: false,
          onKeyDown: (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              handleClose();
            }
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ px: 1.5, py: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: primitives.night[300], cursor: "pointer" }}
            onClick={(event) => {
              event.stopPropagation();
              onChange(resolvedOptions);
            }}
          >
            Выбрать всё
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: primitives.night[300], cursor: "pointer" }}
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
          >
            Очистить
          </Typography>
        </Stack>
        {resolvedOptions.map((option) => {
          const label = labelMap[option as keyof typeof labelMap] ?? option;
          const checked = value.includes(option);
          return (
            <MenuItem
              key={option}
              onClick={(event) => {
                event.stopPropagation();
                handleToggle(option);
              }}
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.preventDefault();
                  handleToggle(option);
                }
              }}
              role="menuitemcheckbox"
              aria-checked={checked}
              sx={{ px: 1.5, py: 0.5, gap: 1 }}
            >
              <Checkbox checked={checked} size="small" />
              <Typography variant="body2">{label}</Typography>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default ScanModesMenu;
