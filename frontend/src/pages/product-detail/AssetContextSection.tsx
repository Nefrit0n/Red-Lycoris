import { Box, Chip, Stack, Typography, alpha, useTheme } from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import SpeedIcon from "@mui/icons-material/Speed";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { GlassCard } from "../../design-system/components";
import type { ProductAssetContext } from "../../types/assetContext";

interface AssetContextSectionProps {
  assetContext: ProductAssetContext | null;
}

const envColors: Record<string, string> = {
  prod: "#dc2626",
  production: "#dc2626",
  staging: "#f59e0b",
  dev: "#1fc3bc",
  development: "#1fc3bc",
  unknown: "#6b7280",
};

const classificationColors: Record<string, string> = {
  restricted: "#9333ea",
  confidential: "#dc2626",
  internal: "#ea580c",
  public: "#16a34a",
  unknown: "#6b7280",
};

const impactColors: Record<string, string> = {
  critical: "#9333ea",
  high: "#dc2626",
  medium: "#ea580c",
  low: "#16a34a",
};

interface ContextCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const ContextCard = ({ icon, label, value, color }: ContextCardProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(color, 0.3),
        bgcolor: alpha(color, 0.06),
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Box sx={{ color: alpha(color, 0.8), display: "flex", alignItems: "center" }}>
        {icon}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ color: theme.palette.mode === "dark" ? color : undefined }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export const AssetContextSection = ({ assetContext }: AssetContextSectionProps) => {
  const theme = useTheme();

  if (!assetContext) {
    return (
      <GlassCard variant="subtle" padding="comfortable">
        <Stack direction="row" spacing={2} alignItems="center">
          <InfoOutlinedIcon sx={{ color: "text.secondary" }} />
          <Box>
            <Typography variant="body2" color="text.secondary">
              No asset context configured.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Add environment, exposure, and classification metadata to improve risk scoring.
            </Typography>
          </Box>
        </Stack>
      </GlassCard>
    );
  }

  const env = assetContext.environment?.toLowerCase() ?? "unknown";
  const classification = assetContext.dataClassification?.toLowerCase() ?? "unknown";
  const impact = assetContext.businessImpact?.toLowerCase() ?? "low";
  const tags = assetContext.tags ?? [];

  return (
    <GlassCard variant="subtle" padding="comfortable">
      <Stack spacing={2}>
        <Typography variant="overline" color="text.secondary">
          Asset Context
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          <ContextCard
            icon={<CloudIcon sx={{ fontSize: 20 }} />}
            label="Environment"
            value={assetContext.environment || "Unknown"}
            color={envColors[env] ?? "#6b7280"}
          />
          <ContextCard
            icon={<PublicIcon sx={{ fontSize: 20 }} />}
            label="Internet Exposure"
            value={
              assetContext.internetExposed === true
                ? "Internet Exposed"
                : assetContext.internetExposed === false
                  ? "Internal Only"
                  : "Unknown"
            }
            color={
              assetContext.internetExposed === true
                ? theme.palette.error.main
                : assetContext.internetExposed === false
                  ? theme.palette.success.main
                  : "#6b7280"
            }
          />
          <ContextCard
            icon={<LockIcon sx={{ fontSize: 20 }} />}
            label="Data Classification"
            value={assetContext.dataClassification || "Unknown"}
            color={classificationColors[classification] ?? "#6b7280"}
          />
          <ContextCard
            icon={<SpeedIcon sx={{ fontSize: 20 }} />}
            label="Business Impact"
            value={assetContext.businessImpact || "Unknown"}
            color={impactColors[impact] ?? "#6b7280"}
          />
        </Box>

        {tags.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ borderColor: "divider" }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </GlassCard>
  );
};
