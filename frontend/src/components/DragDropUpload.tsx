import {
  Box,
  Typography,
  Stack,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Collapse,
  Paper,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useCallback, useState, useRef, DragEvent, useEffect } from "react";
import {
  ValidationResult,
  validateFile,
  isArchive,
  extractArchive,
  readFromClipboard,
  detectScannerFromContent,
  readFileAsText,
  parseJSONWithErrors,
  detectFileFormat,
} from "../utils/fileValidation";

export interface FileWithValidation {
  file: File;
  validation?: ValidationResult;
  detectedScanner?: string | null;
}

interface DragDropUploadProps {
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: FileWithValidation[]) => void;
  onScannerDetected?: (scannerId: string) => void;
  file: File | null;
  files?: FileWithValidation[];
  accept?: string;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  uploadComplete?: boolean;
  multiple?: boolean;
  showValidation?: boolean;
  enableClipboard?: boolean;
  enableArchives?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#d32f2f",
  high: "#f44336",
  medium: "#ff9800",
  low: "#4caf50",
  info: "#2196f3",
  unknown: "#9e9e9e",
};

const DragDropUpload = ({
  onFileSelect,
  onFilesSelect,
  onScannerDetected,
  file,
  files = [],
  accept = ".json,.sarif,.csv,.xml,.jsonl,.zip",
  disabled = false,
  uploading = false,
  uploadProgress = 0,
  uploadComplete = false,
  multiple = false,
  showValidation = true,
  enableClipboard = true,
  enableArchives = true,
}: DragDropUploadProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [extractingArchive, setExtractingArchive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate file when selected
  useEffect(() => {
    if (!file || !showValidation) {
      setValidation(null);
      return;
    }

    const validate = async () => {
      setValidating(true);
      try {
        const result = await validateFile(file);
        setValidation(result);

        // Try to detect scanner from content
        if (result.valid && result.format !== "unknown" && onScannerDetected) {
          const content = await readFileAsText(file);
          const { data } = parseJSONWithErrors(content);
          if (data) {
            const detected = detectScannerFromContent(data, result.format);
            if (detected) {
              onScannerDetected(detected);
            }
          }
        }
      } catch {
        setValidation({
          valid: false,
          format: "unknown",
          errors: [{ type: "parse", message: "Failed to validate file" }],
          warnings: [],
        });
      } finally {
        setValidating(false);
      }
    };

    void validate();
  }, [file, showValidation, onScannerDetected]);

  // Handle keyboard paste
  useEffect(() => {
    if (!enableClipboard || disabled) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle if this component area has focus or no other input is focused
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const clipboardFile = await readFromClipboard();
      if (clipboardFile) {
        e.preventDefault();
        onFileSelect(clipboardFile);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enableClipboard, disabled, onFileSelect]);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      const processedFiles: FileWithValidation[] = [];

      for (const f of filesArray) {
        // Handle archives
        if (enableArchives && isArchive(f)) {
          setExtractingArchive(true);
          try {
            const extracted = await extractArchive(f);
            for (const { file: extractedFile } of extracted) {
              const result = await validateFile(extractedFile);
              let detectedScanner: string | null = null;

              if (result.valid) {
                try {
                  const content = await readFileAsText(extractedFile);
                  const { data } = parseJSONWithErrors(content);
                  if (data) {
                    detectedScanner = detectScannerFromContent(
                      data,
                      detectFileFormat(content, extractedFile.name)
                    );
                  }
                } catch {
                  // Ignore detection errors
                }
              }

              processedFiles.push({
                file: extractedFile,
                validation: result,
                detectedScanner,
              });
            }
          } catch (error) {
            // Add error for archive extraction failure
            processedFiles.push({
              file: f,
              validation: {
                valid: false,
                format: "unknown",
                errors: [
                  {
                    type: "parse",
                    message:
                      error instanceof Error
                        ? error.message
                        : "Failed to extract archive",
                  },
                ],
                warnings: [],
              },
            });
          } finally {
            setExtractingArchive(false);
          }
        } else {
          // Regular file
          const result = await validateFile(f);
          let detectedScanner: string | null = null;

          if (result.valid) {
            try {
              const content = await readFileAsText(f);
              const { data } = parseJSONWithErrors(content);
              if (data) {
                detectedScanner = detectScannerFromContent(
                  data,
                  detectFileFormat(content, f.name)
                );
              }
            } catch {
              // Ignore detection errors
            }
          }

          processedFiles.push({
            file: f,
            validation: result,
            detectedScanner,
          });
        }
      }

      if (multiple && onFilesSelect) {
        onFilesSelect(processedFiles);
      } else if (processedFiles.length > 0) {
        onFileSelect(processedFiles[0].file);
        if (
          processedFiles[0].detectedScanner &&
          onScannerDetected
        ) {
          onScannerDetected(processedFiles[0].detectedScanner);
        }
      }
    },
    [
      enableArchives,
      multiple,
      onFilesSelect,
      onFileSelect,
      onScannerDetected,
    ]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

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

      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        void processFiles(droppedFiles);
      }
    },
    [disabled, processFiles]
  );

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      void processFiles(selectedFiles);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = "";
  };

  const handlePasteClick = async () => {
    if (disabled) return;
    const clipboardFile = await readFromClipboard();
    if (clipboardFile) {
      onFileSelect(clipboardFile);
    }
  };

  const handleRemoveFile = (index: number) => {
    if (onFilesSelect) {
      const updated = files.filter((_, i) => i !== index);
      onFilesSelect(updated);
    }
  };

  const renderValidationInfo = () => {
    if (!showValidation || !validation) return null;

    const hasErrors = validation.errors.length > 0;
    const hasWarnings = validation.warnings.length > 0;
    const hasPreview = validation.preview;

    if (!hasErrors && !hasWarnings && !hasPreview) return null;

    return (
      <Box sx={{ mt: 2, width: "100%", textAlign: "left" }}>
        {/* Errors */}
        {hasErrors && (
          <Alert severity="error" sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {validation.errors.length} ошибок при валидации
            </Typography>
            {validation.errors.slice(0, 3).map((err, i) => (
              <Typography key={i} variant="caption" display="block">
                {err.line && `Строка ${err.line}: `}
                {err.message}
              </Typography>
            ))}
            {validation.errors.length > 3 && (
              <Typography variant="caption" color="text.secondary">
                ...и ещё {validation.errors.length - 3}
              </Typography>
            )}
          </Alert>
        )}

        {/* Warnings */}
        {hasWarnings && !hasErrors && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {validation.warnings.length} предупреждений
            </Typography>
            {validation.warnings.slice(0, 2).map((warn, i) => (
              <Typography key={i} variant="caption" display="block">
                {warn.message}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Preview */}
        {hasPreview && !hasErrors && (
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                py: 0.5,
              }}
              onClick={() => setShowDetails(!showDetails)}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="body2" fontWeight={500}>
                  {validation.preview!.findingsCount} находок
                </Typography>
                {validation.preview!.toolName && (
                  <Chip
                    label={validation.preview!.toolName}
                    size="small"
                    sx={{ height: 20 }}
                  />
                )}
              </Stack>
              <IconButton size="small">
                {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            {/* Severity breakdown */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
              {Object.entries(validation.preview!.severityCounts).map(
                ([severity, count]) => (
                  <Chip
                    key={severity}
                    label={`${severity}: ${count}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      bgcolor: SEVERITY_COLORS[severity] || SEVERITY_COLORS.unknown,
                      color: "white",
                    }}
                  />
                )
              )}
            </Stack>

            <Collapse in={showDetails}>
              <Paper variant="outlined" sx={{ p: 1, bgcolor: "action.hover" }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Примеры находок:
                </Typography>
                {validation.preview!.sampleFindings.map((finding, i) => (
                  <Box
                    key={i}
                    sx={{
                      py: 0.5,
                      borderBottom:
                        i < validation.preview!.sampleFindings.length - 1
                          ? "1px solid"
                          : "none",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" noWrap>
                      {finding.title}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={finding.severity}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: "0.65rem",
                          bgcolor:
                            SEVERITY_COLORS[finding.severity] ||
                            SEVERITY_COLORS.unknown,
                          color: "white",
                        }}
                      />
                      {finding.location && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {finding.location}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Paper>
            </Collapse>
          </Box>
        )}
      </Box>
    );
  };

  const renderMultipleFiles = () => {
    if (!multiple || files.length === 0) return null;

    return (
      <Stack spacing={1} sx={{ mt: 2, width: "100%" }}>
        {files.map((f, index) => (
          <Paper
            key={`${f.file.name}-${index}`}
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: f.validation?.valid === false ? "error.light" : "action.hover",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {f.validation?.valid === false ? (
                <ErrorIcon fontSize="small" color="error" />
              ) : f.validation?.warnings?.length ? (
                <WarningIcon fontSize="small" color="warning" />
              ) : (
                <InsertDriveFileIcon fontSize="small" color="primary" />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {f.file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(f.file.size)}
                  {f.detectedScanner && ` · ${f.detectedScanner}`}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {f.validation?.preview && (
                <Chip
                  label={`${f.validation.preview.findingsCount}`}
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              )}
              <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
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
          : validation?.valid === false
          ? "error.main"
          : file
          ? "primary.light"
          : "divider",
        borderRadius: 2,
        p: 3,
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
        multiple={multiple}
      />

      {uploading || extractingArchive ? (
        <Stack spacing={2} alignItems="center">
          <Box sx={{ width: "100%", maxWidth: 300 }}>
            <LinearProgress
              variant={extractingArchive ? "indeterminate" : "determinate"}
              value={uploadProgress}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {extractingArchive
              ? "Извлечение архива..."
              : `Загрузка... ${Math.round(uploadProgress)}%`}
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
          <InsertDriveFileIcon
            sx={{
              fontSize: 48,
              color: validation?.valid === false ? "error.main" : "primary.main",
            }}
          />
          <Typography variant="body1" fontWeight={500}>
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(file.size)}
            {validation?.format && validation.format !== "unknown" && (
              <> · {validation.format.toUpperCase()}</>
            )}
          </Typography>

          {validating ? (
            <Box sx={{ width: "100%", maxWidth: 200 }}>
              <LinearProgress sx={{ height: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Проверка файла...
              </Typography>
            </Box>
          ) : (
            renderValidationInfo()
          )}

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

          {/* Action buttons */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {enableClipboard && (
              <Tooltip title="Вставить из буфера (Ctrl+V)">
                <Chip
                  icon={<ContentPasteIcon />}
                  label="Ctrl+V"
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handlePasteClick();
                  }}
                  sx={{ cursor: "pointer" }}
                />
              </Tooltip>
            )}
            {enableArchives && (
              <Tooltip title="Поддерживаются ZIP архивы">
                <Chip
                  icon={<FolderZipIcon />}
                  label="ZIP"
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {multiple
              ? "Поддерживаемые форматы: JSON, SARIF, CSV, XML, ZIP"
              : "Поддерживаемые форматы: JSON, SARIF, CSV, XML"}
          </Typography>
        </Stack>
      )}

      {/* Multiple files list */}
      {renderMultipleFiles()}

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
