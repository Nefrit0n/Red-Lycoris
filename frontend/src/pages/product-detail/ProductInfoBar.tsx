import { Box, Stack, Typography } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import RadarIcon from "@mui/icons-material/Radar";
import TagIcon from "@mui/icons-material/Tag";
import UpdateIcon from "@mui/icons-material/Update";
import { GlassCard } from "../../design-system/components";
import type { ProductDetail } from "../../types/products";

interface ProductInfoBarProps {
  product: ProductDetail;
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const InfoItem = ({ icon, label, value }: InfoItemProps) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>{icon}</Box>
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  </Stack>
);

export const ProductInfoBar = ({ product }: ProductInfoBarProps) => (
  <GlassCard variant="subtle" padding="compact">
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 2, sm: 4 }}
      divider={
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            width: "1px",
            alignSelf: "stretch",
            bgcolor: "divider",
          }}
        />
      }
    >
      <InfoItem
        icon={<CalendarTodayIcon sx={{ fontSize: 16 }} />}
        label="Last scan"
        value={formatDate(product.lastScanAt)}
      />
      <InfoItem
        icon={<RadarIcon sx={{ fontSize: 16 }} />}
        label="Total scans"
        value={String(product.totalScans)}
      />
      <InfoItem
        icon={<UpdateIcon sx={{ fontSize: 16 }} />}
        label="Open findings"
        value={String(product.findingsOpenCount)}
      />
      {product.version && (
        <InfoItem
          icon={<TagIcon sx={{ fontSize: 16 }} />}
          label="Version"
          value={`v${product.version}`}
        />
      )}
    </Stack>
  </GlassCard>
);
