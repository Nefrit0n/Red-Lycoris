import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { memo, useCallback, useMemo, useState } from "react";
import { createProduct } from "../../../api/products";
import { useNotification } from "../../../contexts/NotificationContext";
import { ProductAutocomplete } from "../../../components/ProductAutocomplete";

type ProductSectionProps = {
  selectedProductId: string;
  onProductIdChange: (value: string) => void;
  onProductLabelChange: (value: string) => void;
};

const ProductSection = ({
  selectedProductId,
  onProductIdChange,
  onProductLabelChange,
}: ProductSectionProps) => {
  const { showError, showSuccess } = useNotification();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [identifier, setIdentifier] = useState("");

  const canSubmit = useMemo(() => name.trim().length > 1, [name]);

  const resetDialog = useCallback(() => {
    setName("");
    setVersion("");
    setIdentifier("");
  }, []);

  const handleDialogClose = useCallback(() => {
    if (saving) return;
    setDialogOpen(false);
    resetDialog();
  }, [resetDialog, saving]);

  const handleCreate = useCallback(async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const created = await createProduct({
        name: name.trim(),
        version: version.trim() || undefined,
        identifier: identifier.trim() || undefined,
      });
      onProductIdChange(created.id);
      onProductLabelChange(created.name);
      showSuccess("Продукт создан.");
      setDialogOpen(false);
      resetDialog();
    } catch (err) {
      if (err instanceof Error) {
        showError(err.message);
      } else {
        showError("Не удалось создать продукт.");
      }
    } finally {
      setSaving(false);
    }
  }, [
    canSubmit,
    identifier,
    name,
    onProductIdChange,
    onProductLabelChange,
    resetDialog,
    saving,
    showError,
    showSuccess,
    version,
  ]);

  return (
    <Stack spacing={1.5}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1">Продукт</Typography>
        <Button size="small" variant="text" onClick={() => setDialogOpen(true)}>
          Создать продукт
        </Button>
      </Box>
      <ProductAutocomplete
        value={selectedProductId}
        returnId
        onChange={onProductIdChange}
        onLabelChange={onProductLabelChange}
      />
      <Typography variant="caption" color="text.secondary">
        Выберите продукт или создайте новый прямо здесь.
      </Typography>

      <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Новый продукт</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Название продукта"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lotus Platform"
              required
              autoFocus
            />
            <TextField
              label="Версия (опционально)"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="v1.0.0"
            />
            <TextField
              label="Identifier (опционально)"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="lotus-platform"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose} disabled={saving}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canSubmit || saving}>
            {saving ? "Создание..." : "Создать"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default memo(ProductSection);
