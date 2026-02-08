import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { memo, useCallback, useMemo } from "react";
import {
  SCANNER_CATALOG,
  SCANNER_PRESETS,
  type PresetKey,
  type ScannerCategory,
} from "../../../api/analysisJobs";

type ScannerSectionProps = {
  selectedScanners: string[];
  onScannersChange: (scanners: string[]) => void;
  warnings: string[];
};

const CATEGORY_ORDER: ScannerCategory[] = ["SAST", "SCA", "IAC", "SECRETS"];
const CATEGORY_LABELS: Record<ScannerCategory, string> = {
  SAST: "SAST",
  SCA: "SCA / Dependencies",
  IAC: "IaC / Config",
  SECRETS: "Secrets",
};
const CATEGORY_COLORS: Record<ScannerCategory, "info" | "warning" | "success" | "error"> = {
  SAST: "info",
  SCA: "warning",
  IAC: "success",
  SECRETS: "error",
};

const ScannerSection = ({
  selectedScanners,
  onScannersChange,
  warnings,
}: ScannerSectionProps) => {
  const grouped = useMemo(() => {
    const map = new Map<ScannerCategory, typeof SCANNER_CATALOG>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, SCANNER_CATALOG.filter((s) => s.category === cat));
    }
    return map;
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (selectedScanners.includes(id)) {
        onScannersChange(selectedScanners.filter((s) => s !== id));
      } else {
        onScannersChange([...selectedScanners, id]);
      }
    },
    [selectedScanners, onScannersChange]
  );

  const applyPreset = useCallback(
    (key: PresetKey) => {
      onScannersChange([...SCANNER_PRESETS[key].scanners]);
    },
    [onScannersChange]
  );

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Сканеры</Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {(Object.keys(SCANNER_PRESETS) as PresetKey[]).map((key) => {
          const preset = SCANNER_PRESETS[key];
          const isActive =
            preset.scanners.length === selectedScanners.length &&
            preset.scanners.every((s) => selectedScanners.includes(s));
          return (
            <Button
              key={key}
              size="small"
              variant={isActive ? "contained" : "outlined"}
              onClick={() => applyPreset(key)}
              sx={{ textTransform: "none" }}
            >
              {preset.label}
            </Button>
          );
        })}
      </Stack>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
        gap={2}
      >
        {CATEGORY_ORDER.map((cat) => {
          const scanners = grouped.get(cat) || [];
          if (scanners.length === 0) return null;
          return (
            <Box
              key={cat}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Stack spacing={1.5}>
                <Chip
                  label={CATEGORY_LABELS[cat]}
                  size="small"
                  color={CATEGORY_COLORS[cat]}
                  variant="outlined"
                />
                {scanners.map((scanner) => (
                  <Box key={scanner.id}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedScanners.includes(scanner.id)}
                          onChange={() => toggle(scanner.id)}
                        />
                      }
                      label={
                        <Stack spacing={0}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {scanner.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {scanner.estimatedTime}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {scanner.description}
                          </Typography>
                        </Stack>
                      }
                      sx={{ alignItems: "flex-start", ml: 0 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>

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
