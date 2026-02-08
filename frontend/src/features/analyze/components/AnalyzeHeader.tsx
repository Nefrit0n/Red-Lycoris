import { Box, Button, Stack, Typography } from "@mui/material";

type AnalyzeHeaderProps = {
  onHistoryClick: () => void;
};

const AnalyzeHeader = ({ onHistoryClick }: AnalyzeHeaderProps) => {
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4">Анализ</Typography>
          <Typography variant="body2" color="text.secondary">
            Настройте продукт, источник и набор сканеров для запуска анализа.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={onHistoryClick}>
          История анализов
        </Button>
      </Stack>
    </Box>
  );
};

export default AnalyzeHeader;
