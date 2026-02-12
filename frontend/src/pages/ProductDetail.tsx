import { Alert, Box, Button, CircularProgress, Container, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useProductDetail } from "../hooks/useProductDetail";
import { calculateHealthScore } from "../utils/productHealth";
import {
  ProductHeroHeader,
  ProductInfoBar,
  AssetContextSection,
  SecurityPostureMetrics,
  ProductChartsSection,
  RecentScansTimeline,
  SbomSection,
} from "./product-detail";

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product, assetContext, loading, error } = useProductDetail(id);

  if (!id) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Invalid product ID</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || "Product not found"}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/products")} sx={{ mt: 2 }}>
          Back to products
        </Button>
      </Container>
    );
  }

  const healthScore = calculateHealthScore(product.severityBreakdown);
  const criticalHighCount =
    (product.severityBreakdown?.critical || 0) + (product.severityBreakdown?.high || 0);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <ProductHeroHeader
          product={product}
          assetContext={assetContext}
          healthScore={healthScore}
          onBack={() => navigate("/products")}
          onViewFindings={() =>
            navigate({ pathname: "/findings", search: `?productId=${id}` })
          }
          onUploadScan={() => navigate("/scans/upload")}
        />

        <ProductInfoBar product={product} />

        <AssetContextSection assetContext={assetContext} />

        <SecurityPostureMetrics
          openFindings={product.findingsOpenCount}
          criticalHighCount={criticalHighCount}
          fixedCount={product.findingsFixedCount || 0}
          falsePositiveCount={product.findingsFalsePositiveCount || 0}
          trend={
            product.trend && product.trendValue
              ? { direction: product.trend, value: product.trendValue }
              : undefined
          }
        />

        <ProductChartsSection
          severityBreakdown={product.severityBreakdown}
          openCount={product.findingsOpenCount}
          fixedCount={product.findingsFixedCount || 0}
          falsePositiveCount={product.findingsFalsePositiveCount || 0}
        />

        <RecentScansTimeline
          scans={product.recentScans}
          totalScans={product.totalScans}
          productId={id}
          onUploadScan={() => navigate("/scans/upload")}
        />

        <SbomSection productId={id} />
      </Stack>
    </Container>
  );
};

export default ProductDetailPage;
