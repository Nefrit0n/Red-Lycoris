import React from "react";
import { Box } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import { MetricDisplay } from "../design-system/components";

export interface ProductKpiRowProps {
  loading?: boolean;
  totalProducts: number | null;
  productsAtRisk: number | null;
  openFindings: number | null;
  lastScanLabel: string | null;
}

const ProductKpiRow = ({
  loading = false,
  totalProducts,
  productsAtRisk,
  openFindings,
  lastScanLabel,
}: ProductKpiRowProps) => {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <MetricDisplay
        title="Total Products"
        value={totalProducts ?? "—"}
        loading={loading}
        size="small"
        variant="subtle"
        color="default"
        icon={<Inventory2OutlinedIcon />}
      />
      <MetricDisplay
        title="Products at Risk"
        value={productsAtRisk ?? "—"}
        loading={loading}
        size="small"
        variant="subtle"
        color="warning"
        icon={<WarningAmberOutlinedIcon />}
      />
      <MetricDisplay
        title="Open Findings"
        value={openFindings ?? "—"}
        loading={loading}
        size="small"
        variant="subtle"
        color="error"
        icon={<BugReportOutlinedIcon />}
      />
      <MetricDisplay
        title="Last Scan Activity"
        value={lastScanLabel ?? "—"}
        loading={loading}
        size="small"
        variant="subtle"
        color="lotus"
        icon={<AccessTimeOutlinedIcon />}
      />
    </Box>
  );
};

export default ProductKpiRow;
