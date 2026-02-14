import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Button } from "../../design-system/components/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "default" | "danger";
  confirmationText?: string;
  value?: string;
  onChange?: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  confirmTone = "default",
  confirmationText,
  value,
  onChange,
  onConfirm,
  onClose,
}: ConfirmDialogProps) => {
  const isDisabled = confirmationText ? value?.trim() !== confirmationText : false;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {description && <Typography color="text.secondary">{description}</Typography>}
          {confirmationText && (
            <TextField
              label="Введите подтверждающую строку"
              placeholder={confirmationText}
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={confirmTone === "danger" ? "error" : "primary"}
          onClick={onConfirm}
          disabled={isDisabled}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
