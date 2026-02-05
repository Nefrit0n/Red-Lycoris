import {
  Box,
  Button,
  Checkbox,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { useMemo, useRef, useState } from "react";
import { FiltersState } from "../../filters/types";
import { primitives } from "../../../design-system/tokens/colors";

interface TypesMenuProps {
  value: FiltersState["categories"];
  onChange: (next: FiltersState["categories"]) => void;
  options: Array<{ value: string; label: string }>;
}

const TypesMenu = ({ value, onChange, options }: TypesMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const label = useMemo(() => {
    if (!value.length) return "Все типы";
    const labels = options.filter((option) => value.includes(option.value)).map(
      (option) => option.label
    );
    const visible = labels.slice(0, 2);
    const hidden = labels.length - visible.length;
    return hidden > 0 ? `${visible.join(", ")} +${hidden}` : visible.join(", ");
  }, [value]);

  const handleToggle = (nextValue: string) => {
    if (value.includes(nextValue)) {
      onChange(value.filter((item) => item !== nextValue));
    } else {
      onChange([...value, nextValue]);
    }
  };

  return (
    <Box data-testid="findings-types-menu">
      <Button
        variant="outlined"
        size="small"
        startIcon={<CategoryOutlinedIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label="Открыть меню типов"
        sx={{
          height: 32,
          borderColor: primitives.night[600],
          color: primitives.night[100],
          "&:hover": { borderColor: primitives.lotus[400], color: primitives.lotus[400] },
          textTransform: "none",
        }}
        ref={buttonRef}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => {
          setAnchorEl(null);
          buttonRef.current?.focus();
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: { width: 240, bgcolor: primitives.night[700], color: primitives.night[50] },
        }}
        MenuListProps={{
          autoFocus: true,
          autoFocusItem: open,
          onKeyDown: (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setAnchorEl(null);
              buttonRef.current?.focus();
            }
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: primitives.night[300], cursor: "pointer" }}
            onClick={() => onChange(options.map((option) => option.value))}
          >
            Выбрать всё
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: primitives.night[300], cursor: "pointer" }}
            onClick={() => onChange([])}
          >
            Очистить
          </Typography>
        </Stack>
        <Divider sx={{ borderColor: primitives.night[600] }} />
        {options.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => handleToggle(option.value)}
            role="menuitemcheckbox"
            aria-checked={value.includes(option.value)}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                handleToggle(option.value);
              }
            }}
          >
            <Checkbox checked={value.includes(option.value)} size="small" />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default TypesMenu;
