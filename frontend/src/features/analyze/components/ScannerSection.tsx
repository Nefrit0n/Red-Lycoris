import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { memo } from "react";

type ScannerSectionProps = {
  runSemgrep: boolean;
  runTrivy: boolean;
  onToggleSemgrep: () => void;
  onToggleTrivy: () => void;
  onPreset: (preset: "fast" | "full") => void;
  warnings: string[];
};

const ScannerSection = ({
  runSemgrep,
  runTrivy,
  onToggleSemgrep,
  onToggleTrivy,
  onPreset,
  warnings,
}: ScannerSectionProps) => {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1">Сканеры</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Semgrep</Typography>
              <Typography variant="caption" color="text.secondary">
                Поиск уязвимостей в коде и конфигурации.
              </Typography>
              <Button
                size="small"
                variant={runSemgrep ? "contained" : "outlined"}
                onClick={onToggleSemgrep}
              >
                {runSemgrep ? "Включен" : "Выключен"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Trivy</Typography>
              <Typography variant="caption" color="text.secondary">
                Анализ контейнеров и зависимостей.
              </Typography>
              <Button
                size="small"
                variant={runTrivy ? "contained" : "outlined"}
                onClick={onToggleTrivy}
              >
                {runTrivy ? "Включен" : "Выключен"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button size="small" variant="outlined" onClick={() => onPreset("fast")}>
          Быстро
        </Button>
        <Button size="small" variant="outlined" onClick={() => onPreset("full")}>
          Полный
        </Button>
      </Stack>
      {warnings.length > 0 && (
        <Stack spacing={0.5}>
          {warnings.map((warning) => (
            <Typography key={warning} variant="caption" color="warning.main">
              {warning}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default memo(ScannerSection);
