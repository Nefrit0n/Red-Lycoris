import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

type RunSummaryProps = {
  productSummary: string;
  sourceSummary: string;
  scannerSummary: string;
  submitting: boolean;
  uploadProgress: number | null;
  lastJobId?: string | null;
  onSubmit: () => void;
  submitError?: string | null;
  onRetry?: () => void;
  canSubmit?: boolean;
};

const RunSummary = ({
  productSummary,
  sourceSummary,
  scannerSummary,
  submitting,
  uploadProgress,
  lastJobId,
  onSubmit,
  submitError,
  onRetry,
  canSubmit = true,
}: RunSummaryProps) => {
  return (
    <Card
      variant="outlined"
      sx={{
        width: { xs: "100%", lg: 320 },
        position: { lg: "sticky" },
        top: { lg: 24 },
        alignSelf: { lg: "flex-start" },
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Сводка запуска</Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Продукт: {productSummary}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Источник: {sourceSummary}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Сканеры: {scannerSummary}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              fullWidth
              variant="contained"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
            >
              Запустить анализ
            </Button>
            <Box sx={{ width: 20, display: "flex", justifyContent: "center" }}>
              {submitting && <CircularProgress size={16} />}
            </Box>
          </Stack>

          {/* Reserve fixed height for progress/error area to prevent CLS */}
          <Box sx={{ minHeight: 40 }}>
            {uploadProgress !== null && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Загрузка архива: {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Stack>
            )}

            {submitError && (
              <Box>
                <Typography variant="body2" color="error">
                  {submitError}
                </Typography>
                {onRetry && (
                  <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={onRetry}>
                    Повторить
                  </Button>
                )}
              </Box>
            )}
          </Box>

          {lastJobId && (
            <>
              <Divider />
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Последний запуск
                </Typography>
                <Button
                  component={Link}
                  to={`/analyze/${lastJobId}`}
                  size="small"
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  → Анализ #{lastJobId.slice(0, 8)}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RunSummary;
