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
  Tooltip,
  Typography,
} from "@mui/material";
import {
  BookmarkBorder as BookmarkIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { useSavedViews, SavedView } from "../hooks/useSavedViews";
import { FiltersState } from "../types/filters";

interface ViewsDropdownProps {
  currentFilters: FiltersState;
  onApplyView: (filters: Partial<FiltersState>) => void;
}

const ViewsDropdown = ({ currentFilters, onApplyView }: ViewsDropdownProps) => {
  const { views, builtInViews, saveView, deleteView, updateView } = useSavedViews();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [viewToEdit, setViewToEdit] = useState<SavedView | null>(null);

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

  const handleOpenRenameDialog = (view: SavedView) => {
    setViewToEdit(view);
    setNewViewName(view.name);
    setRenameDialogOpen(true);
    handleCloseMenu();
  };

  const handleRenameView = () => {
    if (viewToEdit && newViewName.trim()) {
      updateView(viewToEdit.id, newViewName.trim(), viewToEdit.filters);
      setRenameDialogOpen(false);
      setViewToEdit(null);
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
      currentFilters.riskBands.length ||
      currentFilters.occurrences.length ||
      currentFilters.scannerTypes.length ||
      currentFilters.policyDecisions.length ||
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
          sx: { width: 300, maxHeight: 420 },
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
                Сохраненные виды
              </Typography>
            </Box>
            {views.map((view) => (
              <MenuItem key={view.id} onClick={() => handleApplyView(view)} sx={{ py: 1, pr: 9 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <BookmarkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={view.name}
                  secondary={new Date(view.createdAt).toLocaleDateString("ru-RU")}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
                <Box sx={{ position: "absolute", right: 8, display: "flex", gap: 0.5 }}>
                  <Tooltip title="Переименовать">
                    <IconButton size="small" onClick={() => handleOpenRenameDialog(view)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Удалить">
                    <IconButton size="small" onClick={(e) => handleDeleteView(e, view.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveView} variant="contained" disabled={!newViewName.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Переименовать вид</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Новое название"
            fullWidth
            value={newViewName}
            onChange={(event) => setNewViewName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleRenameView} variant="contained" disabled={!newViewName.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ViewsDropdown;
