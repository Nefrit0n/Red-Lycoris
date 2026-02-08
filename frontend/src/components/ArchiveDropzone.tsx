import { Box, Button, Stack, Typography } from "@mui/material";
import { useMemo } from "react";

interface ArchiveDropzoneProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  helperText?: string;
  label?: string;
}

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const ArchiveDropzone = ({
  value,
  onChange,
  disabled = false,
  helperText,
  label = "Загрузить архив (.zip, .tar.gz, .tgz)",
}: ArchiveDropzoneProps) => {
  const fileLabel = useMemo(() => {
    if (!value) return "Файл не выбран";
    return `${value.name} · ${formatFileSize(value.size)}`;
  }, [value]);

  return (
    <Box
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        px: 2,
        py: 2,
        bgcolor: "background.default",
        minHeight: 96,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ width: "100%" }}
      >
        <Box>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography color="text.secondary" variant="body2">
            {fileLabel}
          </Typography>
          {helperText && (
            <Typography color="text.secondary" variant="caption">
              {helperText}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component="label" disabled={disabled} size="small">
            Выбрать файл
            <input
              hidden
              type="file"
              accept=".zip,.tar.gz,.tgz"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                onChange(selected);
                event.currentTarget.value = "";
              }}
            />
          </Button>
          {value && (
            <Button
              variant="text"
              size="small"
              color="inherit"
              onClick={() => onChange(null)}
            >
              Удалить
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
