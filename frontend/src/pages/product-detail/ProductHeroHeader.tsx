import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudIcon from "@mui/icons-material/Cloud";
import PublicIcon from "@mui/icons-material/Public";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { GlassCard, MetricDisplay, RiskBadge } from "../../design-system/components";
import type { ProductDetail } from "../../types/products";
import type { ProductAssetContext } from "../../types/assetContext";

interface ProductHeroHeaderProps {
  product: ProductDetail;
  assetContext: ProductAssetContext | null;
  healthScore: number;
  onBack: () => void;
  onViewFindings: () => void;
  onUploadScan: () => void;
}

const envConfig: Record<string, { label: string; color: string }> = {
  prod: { label: "Production", color: "#dc2626" },
  production: { label: "Production", color: "#dc2626" },
  staging: { label: "Staging", color: "#f59e0b" },
  dev: { label: "Development", color: "#1fc3bc" },
  development: { label: "Development", color: "#1fc3bc" },
};

const healthColor = (score: number, palette: { success: { main: string }; info: { main: string }; warning: { main: string }; error: { main: string } }) =>
  score >= 80
    ? palette.success.main
    : score >= 60
      ? palette.info.main
      : score >= 40
        ? palette.warning.main
        : palette.error.main;

export const ProductHeroHeader = ({
  product,
  assetContext,
  healthScore,
  onBack,
  onViewFindings,
  onUploadScan,
}: ProductHeroHeaderProps) => {
  const theme = useTheme();
  const color = healthColor(healthScore, theme.palette);

  const env = assetContext?.environment?.toLowerCase();
  const envCfg = env ? envConfig[env] : undefined;

  return (
    <Stack spacing={2}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{ alignSelf: "flex-start" }}
      >
        Back to products
      </Button>

      <GlassCard variant="medium" glowColor="lotus" padding="comfortable">
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" component="h1" fontWeight={700} noWrap>
              {product.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {product.identifier || "No repository linked"}
              {product.version && ` \u00B7 v${product.version}`}
            </Typography>
            {product.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {product.description}
              </Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              {envCfg && (
                <Chip
                  icon={<CloudIcon sx={{ fontSize: 16 }} />}
                  label={envCfg.label}
                  size="small"
                  sx={{
                    bgcolor: alpha(envCfg.color, 0.15),
                    color: envCfg.color,
                    border: `1px solid ${alpha(envCfg.color, 0.3)}`,
                    fontWeight: 600,
                  }}
                />
              )}
              {assetContext?.internetExposed && (
                <Chip
                  icon={<PublicIcon sx={{ fontSize: 16 }} />}
                  label="Internet Exposed"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.15),
                    color: theme.palette.error.main,
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                    fontWeight: 600,
                  }}
                />
              )}
              {assetContext?.internetExposed === false && (
                <Chip
                  icon={<PublicIcon sx={{ fontSize: 16 }} />}
                  label="Internal Only"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.15),
                    color: theme.palette.success.main,
                    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                    fontWeight: 600,
                  }}
                />
              )}
              {product.assetCriticality && (
                <RiskBadge
                  risk={product.assetCriticality as "critical" | "high" | "medium" | "low" | "none"}
                  size="small"
                />
              )}
            </Stack>
          </Box>

          <Stack spacing={2} alignItems={{ xs: "flex-start", lg: "flex-end" }}>
            <MetricDisplay
              title="Health Score"
              value={healthScore}
              suffix="%"
              size="large"
              color={healthScore >= 80 ? "success" : healthScore >= 60 ? "jade" : healthScore >= 40 ? "warning" : "error"}
              animate
              variant="subtle"
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={onViewFindings}
              >
                View findings ({product.findingsOpenCount})
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={onUploadScan}
              >
                Upload scan
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </GlassCard>
    </Stack>
  );
};
