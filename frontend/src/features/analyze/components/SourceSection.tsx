import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { memo } from "react";
import { ArchiveDropzone } from "../../../components/ArchiveDropzone";
import { SourceSnapshot } from "../../../api/sourceSnapshots";

export type SourceMode = "latest" | "select" | "upload" | "ephemeral";

type SourceSectionProps = {
  sourceMode: SourceMode;
  onSourceModeChange: (mode: SourceMode) => void;
  hasProduct: boolean;
  archive: File | null;
  onArchiveChange: (file: File | null) => void;
  latestSnapshot: SourceSnapshot | null;
  latestSnapshotLoading: boolean;
  snapshots: SourceSnapshot[];
  snapshotsLoading: boolean;
  selectedSnapshotId: string;
  onSnapshotChange: (value: string) => void;
  showSnapshotWarnings: boolean;
};

const SourceSection = ({
  sourceMode,
  onSourceModeChange,
  hasProduct,
  archive,
  onArchiveChange,
  latestSnapshot,
  latestSnapshotLoading,
  snapshots,
  snapshotsLoading,
  selectedSnapshotId,
  onSnapshotChange,
  showSnapshotWarnings,
}: SourceSectionProps) => {
  const latestInfo = latestSnapshot
    ? `Создан ${new Date(latestSnapshot.createdAt).toLocaleString("ru-RU")}`
    : "Снапшоты ещё не загружались";

  const snapshotLabel = (snapshot: SourceSnapshot) =>
    snapshot.label ||
    snapshot.originalFilename ||
    `Снапшот · ${new Date(snapshot.createdAt).toLocaleString("ru-RU")}`;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1">Исходники</Typography>
      <FormControl component="fieldset">
        <FormLabel component="legend">Режим источника</FormLabel>
        <RadioGroup
          value={sourceMode}
          onChange={(event) => onSourceModeChange(event.target.value as SourceMode)}
        >
          <FormControlLabel
            value="latest"
            control={<Radio size="small" />}
            label="Использовать последний снапшот"
            disabled={!hasProduct}
          />
          <FormControlLabel
            value="select"
            control={<Radio size="small" />}
            label="Выбрать снапшот из списка"
            disabled={!hasProduct}
          />
          <FormControlLabel
            value="upload"
            control={<Radio size="small" />}
            label="Загрузить и сохранить новый снапшот"
            disabled={!hasProduct}
          />
          <FormControlLabel
            value="ephemeral"
            control={<Radio size="small" />}
            label="Загрузить архив только для этой задачи"
            disabled={!hasProduct}
          />
        </RadioGroup>
      </FormControl>

      {sourceMode === "latest" && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {latestSnapshotLoading ? "Проверяем снапшоты..." : latestInfo}
          </Typography>
          {latestSnapshot && (
            <Typography variant="caption" color="text.secondary">
              Размер: {Math.round(latestSnapshot.size / 1024)} KB
            </Typography>
          )}
        </Paper>
      )}

      {sourceMode === "select" && (
        <Stack spacing={1}>
          <Select
            size="small"
            value={selectedSnapshotId}
            onChange={(event) => onSnapshotChange(event.target.value)}
            displayEmpty
          >
            <MenuItem value="">
              {snapshotsLoading ? "Загрузка списка..." : "Выберите снапшот"}
            </MenuItem>
            {snapshots.map((snapshot) => (
              <MenuItem key={snapshot.id} value={snapshot.id}>
                {snapshotLabel(snapshot)}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary">
            В списке показаны последние снапшоты продукта.
          </Typography>
        </Stack>
      )}

      {(sourceMode === "upload" || sourceMode === "ephemeral") && (
        <Stack spacing={1}>
          <ArchiveDropzone
            value={archive}
            onChange={onArchiveChange}
            helperText="Поддерживаются .zip, .tar.gz, .tgz"
          />
          {showSnapshotWarnings && (
            <Box>
              <Typography variant="caption" color="warning.main">
                Для запуска анализа нужно выбрать архив или снапшот.
              </Typography>
            </Box>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default memo(SourceSection);
