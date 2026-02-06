import {
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { primitives } from "../../design-system/tokens/colors";

export interface PillDropdownOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface PillDropdownMultiProps {
  label: string;
  summary: string;
  options: PillDropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const PillDropdownMulti = ({
  label,
  summary,
  options,
  selected,
  onChange,
  searchable = false,
  open,
  onToggle,
  onClose,
}: PillDropdownMultiProps) => {
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) {
      return options;
    }
    const lowered = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(lowered));
  }, [options, query, searchable]);

  const handleToggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const handleSelectAll = () => {
    onChange(options.map((option) => option.id));
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
        onClick={onToggle}
        sx={{
          borderRadius: "999px",
          textTransform: "none",
          height: 36,
          fontSize: 12,
          px: 1.5,
          color: primitives.night[50],
          borderColor: primitives.night[600],
          justifyContent: "space-between",
          "&:hover": {
            borderColor: primitives.lotus[400],
            bgcolor: "rgba(225, 29, 72, 0.08)",
          },
        }}
        aria-label={label}
        fullWidth
        ref={buttonRef}
      >
        {label}: {summary}
      </Button>

      <Popper
        open={open}
        anchorEl={buttonRef.current}
        placement="bottom-start"
        disablePortal
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 3 }}
      >
        <ClickAwayListener
          onClickAway={(event) => {
            if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
              return;
            }
            onClose();
            buttonRef.current?.focus();
          }}
        >
          <Paper
            sx={{
              width: 260,
              bgcolor: primitives.night[800],
              color: primitives.night[50],
              p: 1,
              border: `1px solid ${primitives.night[600]}`,
              boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                buttonRef.current?.focus();
              }
            }}
          >
            <Stack spacing={1} sx={{ px: 1, pt: 0.5, pb: 0.75 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ color: primitives.night[200] }}>
                  {label}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="text" onClick={handleSelectAll}>
                    Выбрать всё
                  </Button>
                  <Button size="small" variant="text" onClick={handleClear}>
                    Очистить
                  </Button>
                </Stack>
              </Stack>
              {searchable && (
                <TextField
                  size="small"
                  placeholder="Поиск"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  sx={{
                    "& .MuiInputBase-root": {
                      bgcolor: primitives.night[700],
                    },
                  }}
                />
              )}
            </Stack>
            <MenuList dense disablePadding sx={{ maxHeight: 220, overflowY: "auto", pb: 0.5 }}>
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <MenuItem
                    key={option.id}
                    onClick={() => handleToggle(option.id)}
                    dense
                    sx={{ px: 1.5, py: 0.5, gap: 1 }}
                  >
                    <Checkbox checked={selectedSet.has(option.id)} size="small" />
                    {option.icon && <Box sx={{ display: "inline-flex" }}>{option.icon}</Box>}
                    <Typography variant="body2">{option.label}</Typography>
                  </MenuItem>
                ))
              ) : (
                <Typography variant="caption" sx={{ color: primitives.night[300], px: 2 }}>
                  Нет вариантов
                </Typography>
              )}
            </MenuList>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
};

export default PillDropdownMulti;
