import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ClearIcon from "@mui/icons-material/Clear";
import { ReactNode } from "react";
import { focusRing } from "../design-system/tokens";
import { primitives } from "../design-system/tokens/colors";

export interface SavedFilterView {
  id: string;
  name: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeCount: number;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  savedViews: SavedFilterView[];
  selectedViewId: string;
  onSelectView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
  onSaveView?: () => void;
  children?: ReactNode;
}

const FilterBar = ({
  searchValue,
  onSearchChange,
  activeCount,
  onOpenFilters,
  onResetFilters,
  savedViews,
  selectedViewId,
  onSelectView,
  onDeleteView,
  children,
}: FilterBarProps) => {
  const handleViewChange = (event: SelectChangeEvent<string>) => {
    onSelectView(event.target.value);
  };

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: alpha(primitives.night[500], 0.5),
          bgcolor: alpha(primitives.night[750], 0.65),
          backdropFilter: "blur(10px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <TextField
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: primitives.night[300] }} />
                </InputAdornment>
              ),
              endAdornment: searchValue ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => onSearchChange("")}
                    aria-label="Очистить поиск"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              maxWidth: { xs: "100%", md: 360 },
              "& .MuiOutlinedInput-root": {
                height: 40,
                bgcolor: alpha(primitives.night[700], 0.6),
                borderRadius: 1.5,
                "& fieldset": { borderColor: alpha(primitives.night[500], 0.7) },
                "&:hover fieldset": { borderColor: alpha(primitives.night[400], 0.8) },
                "&.Mui-focused": {
                  boxShadow: focusRing.subtle,
                },
              },
            }}
          />

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: "space-between", md: "flex-end" }}
            flexWrap="wrap"
            useFlexGap
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Наборы
              </Typography>
              <Select
                size="small"
                value={selectedViewId}
                onChange={handleViewChange}
                displayEmpty
                sx={{
                  minWidth: 180,
                  bgcolor: alpha(primitives.night[700], 0.5),
                  borderRadius: 1.5,
                  "& .MuiSelect-select": { py: 0.75 },
                  "&.Mui-focused": { boxShadow: focusRing.subtle },
                }}
              >
                <MenuItem value="default">По умолчанию</MenuItem>
                {savedViews.map((view) => (
                  <MenuItem key={view.id} value={view.id} sx={{ pr: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ width: "100%" }}
                    >
                      <Typography variant="body2">{view.name}</Typography>
                      <IconButton
                        size="small"
                        aria-label={`Удалить набор ${view.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: alpha(primitives.night[600], 0.6) }} />

            <Badge
              badgeContent={activeCount}
              color="error"
              invisible={activeCount === 0}
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: primitives.lotus[500],
                  color: primitives.white,
                  fontWeight: 600,
                },
              }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={onOpenFilters}
                startIcon={<FilterListIcon />}
                sx={{
                  height: 36,
                  borderColor: activeCount > 0 ? primitives.lotus[500] : alpha(primitives.night[500], 0.6),
                  color: activeCount > 0 ? primitives.lotus[300] : primitives.night[200],
                  bgcolor: alpha(primitives.night[800], 0.4),
                  textTransform: "none",
                  "&:hover": {
                    borderColor: primitives.lotus[500],
                    bgcolor: alpha(primitives.lotus[500], 0.12),
                  },
                }}
              >
                Фильтры
              </Button>
            </Badge>

            {activeCount > 0 ? (
              <Button
                variant="text"
                size="small"
                onClick={onResetFilters}
                startIcon={<RestartAltIcon />}
                sx={{
                  height: 36,
                  color: primitives.night[200],
                  textTransform: "none",
                  "&:hover": { color: primitives.lotus[300] },
                }}
              >
                Сбросить
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      {children ? <Box>{children}</Box> : null}
    </Stack>
  );
};

export default FilterBar;
