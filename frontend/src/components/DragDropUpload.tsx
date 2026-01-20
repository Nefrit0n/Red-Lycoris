import { Box, Typography, Stack, LinearProgress, Chip } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useCallback, useState, useRef, DragEvent } from "react";

interface DragDropUploadProps {
  onFileSelect: (file: File) => void;
  file: File | null;
  accept?: string;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  uploadComplete?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const DragDropUpload = ({
  onFileSelect,
  file,
  accept = ".json,.sarif",
  disabled = false,
  uploading = false,
  uploadProgress = 0,
  uploadComplete = false,
}: DragDropUploadProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [disabled, onFileSelect]
  );

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = "";
  };

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      sx={{
        border: "2px dashed",
        borderColor: isDragActive
          ? "primary.main"
          : uploadComplete
          ? "success.main"
          : file
          ? "primary.light"
          : "divider",
        borderRadius: 2,
        p: 4,
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        bgcolor: isDragActive
          ? "action.hover"
          : uploadComplete
          ? "success.main"
          : "transparent",
        opacity: disabled ? 0.6 : 1,
        "&:hover": {
          bgcolor: disabled ? "transparent" : "action.hover",
          borderColor: disabled ? "divider" : "primary.main",
        },
        position: "relative",
        overflow: "hidden",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {uploading ? (
        <Stack spacing={2} alignItems="center">
          <Box sx={{ width: "100%", maxWidth: 300 }}>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Загрузка... {Math.round(uploadProgress)}%
          </Typography>
          {file && (
            <Chip
              icon={<InsertDriveFileIcon />}
              label={file.name}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      ) : uploadComplete ? (
        <Stack spacing={1} alignItems="center">
          <CheckCircleIcon sx={{ fontSize: 48, color: "white" }} />
          <Typography variant="body1" fontWeight={500} color="white">
            Загрузка завершена
          </Typography>
          {file && (
            <Chip
              icon={<InsertDriveFileIcon />}
              label={file.name}
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
            />
          )}
        </Stack>
      ) : file ? (
        <Stack spacing={1} alignItems="center">
          <InsertDriveFileIcon sx={{ fontSize: 48, color: "primary.main" }} />
          <Typography variant="body1" fontWeight={500}>
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(file.size)}
          </Typography>
          <Typography variant="caption" color="primary">
            Нажмите или перетащите другой файл для замены
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1} alignItems="center">
          <CloudUploadIcon
            sx={{
              fontSize: 48,
              color: isDragActive ? "primary.main" : "text.secondary",
              transition: "color 0.2s ease",
            }}
          />
          <Typography variant="body1" fontWeight={500}>
            {isDragActive ? "Отпустите файл здесь" : "Перетащите файл сюда"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            или нажмите для выбора
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Поддерживаемые форматы: JSON, SARIF
          </Typography>
        </Stack>
      )}

      {/* Drag overlay animation */}
      {isDragActive && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "primary.main",
            opacity: 0.1,
            pointerEvents: "none",
          }}
        />
      )}
    </Box>
  );
};

export default DragDropUpload;
