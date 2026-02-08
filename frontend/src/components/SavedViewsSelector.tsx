import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  BookmarkBorder as BookmarkIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { SavedView, useSavedViews } from "../hooks/useSavedViews";
import { FiltersState } from "../features/filters/types";

interface SavedViewsSelectorProps {
  currentFilters: FiltersState;
  onApplyView: (filters: Partial<FiltersState>) => void;
}

const SavedViewsSelector = ({ currentFilters, onApplyView }: SavedViewsSelectorProps) => {
  const { views, builtInViews, saveView, deleteView } = useSavedViews();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleApplyView = (view: SavedView) => {
    onApplyView(view.filters);
    handleCloseMenu();
  };

  const handleOpenSaveDialog = () => {
    setNewViewName("");
    setSaveDialogOpen(true);
    handleCloseMenu();
  };

  const handleSaveView = () => {
    if (newViewName.trim()) {
      saveView(newViewName.trim(), currentFilters);
      setSaveDialogOpen(false);
      setNewViewName("");
    }
  };

  const handleDeleteView = (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    deleteView(viewId);
  };

  const hasActiveFilters = Boolean(
    currentFilters.productIds.length ||
      currentFilters.search ||
      currentFilters.severities.length ||
      currentFilters.statuses.length ||
      currentFilters.occurrences.length ||
      currentFilters.scannerTypes.length ||
      currentFilters.languages.length ||
      currentFilters.policyDecisions.length ||
      currentFilters.riskBands.length ||
      currentFilters.categories.length ||
      currentFilters.datePreset ||
      currentFilters.dateFrom ||
      currentFilters.dateTo ||
      currentFilters.showRepeats
  );

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpenMenu}
        endIcon={<ExpandMoreIcon />}
        startIcon={<BookmarkIcon />}
        sx={{ whiteSpace: "nowrap" }}
      >
        Виды
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: { width: 280, maxHeight: 400 },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Быстрые наборы
          </Typography>
        </Box>
        {builtInViews.map((view) => (
          <MenuItem key={view.id} onClick={() => handleApplyView(view)} sx={{ py: 1 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <StarIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText primary={view.name} />
          </MenuItem>
        ))}

        {views.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Сохранённые виды
              </Typography>
            </Box>
            {views.map((view) => (
              <MenuItem key={view.id} onClick={() => handleApplyView(view)} sx={{ py: 1, pr: 6 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <BookmarkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={view.name}
                  secondary={new Date(view.createdAt).toLocaleDateString("ru-RU")}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => handleDeleteView(e, view.id)}
                  sx={{
                    position: "absolute",
                    right: 8,
                    opacity: 0.6,
                    "&:hover": { opacity: 1 },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            ))}
          </>
        )}

        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleOpenSaveDialog} disabled={!hasActiveFilters}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Сохранить текущий вид"
            secondary={hasActiveFilters ? undefined : "Фильтры не выбраны"}
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
      </Menu>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Сохранить вид</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название вида"
            fullWidth
            value={newViewName}
            onChange={(event) => setNewViewName(event.target.value)}
            placeholder="Например, критичные за неделю"
            onKeyDown={(event) => {
              if (event.key === "Enter" && newViewName.trim()) {
                handleSaveView();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveView} variant="contained" disabled={!newViewName.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SavedViewsSelector;
