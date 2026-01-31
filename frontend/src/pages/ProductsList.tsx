import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  InputAdornment,
  useTheme,
} from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { fetchProductsWithStats } from "../api/products";
import PaginationControl from "../components/PaginationControl";
import ProductGridCard from "../components/ProductGridCard";
import ProductKpiRow from "../components/ProductKpiRow";
import ProductListRow from "../components/ProductListRow";
import { ProductWithStats } from "../types/products";
import { calculateHealthScore } from "../utils/productHealth";

const VIEW_MODE_KEY = "productsViewMode";

type ViewMode = "grid" | "list";

const ProductsList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ProductWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const urlView = searchParams.get("view") as ViewMode;
    if (urlView === "grid" || urlView === "list") return urlView;
    const stored = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
    return stored === "list" ? "list" : "grid";
  });

  const handleViewChange = (_: React.MouseEvent, newView: ViewMode | null) => {
    if (!newView) return;
    setViewMode(newView);
    localStorage.setItem(VIEW_MODE_KEY, newView);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("view", newView);
    setSearchParams(newParams, { replace: true });
  };

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchProductsWithStats(pageSize, page * pageSize, signal);
        setData(response.data);
        setTotal(response.total);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Unable to load products list.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleProductClick = (productId: string) => {
    navigate(`/products/${productId}`);
  };

  const handleViewFindings = (productId: string) => {
    navigate({
      pathname: "/findings",
      search: `?productId=${productId}`,
    });
  };

  const handleUploadScan = () => {
    navigate("/scans/upload");
  };

  const formatLastScanActivity = (date: Date) => {
    const minutes = differenceInMinutes(new Date(), date);
    if (minutes < 1) return "Updated just now";
    if (minutes < 60) return `Updated ${minutes} min ago`;
    const hours = differenceInHours(new Date(), date);
    if (hours < 24) return `Updated ${hours}h ago`;
    const days = differenceInDays(new Date(), date);
    return `Updated ${days}d ago`;
  };

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const query = search.toLowerCase();
    return data.filter((item) =>
      [item.name, item.identifier, item.version].some((field) =>
        (field ?? "").toLowerCase().includes(query)
      )
    );
  }, [data, search]);

  const metrics = useMemo(() => {
    if (loading || data.length === 0) {
      return {
        totalProducts: total > 0 ? total : null,
        productsAtRisk: null,
        openFindings: null,
        lastScanLabel: null,
      };
    }

    const openFindings = data.reduce((acc, item) => acc + (item.findingsOpenCount || 0), 0);
    const productsAtRisk = data.filter((item) => {
      const breakdown = item.severityBreakdown;
      const hasHighCritical = (breakdown?.critical ?? 0) + (breakdown?.high ?? 0) > 0;
      const healthScore = calculateHealthScore(breakdown);
      return hasHighCritical || healthScore < 80;
    }).length;

    const lastScan = data
      .map((item) => (item.lastScanAt ? new Date(item.lastScanAt) : null))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const lastScanLabel = lastScan ? formatLastScanActivity(lastScan) : "No recent scans";

    return {
      totalProducts: total > 0 ? total : data.length,
      productsAtRisk: productsAtRisk || 0,
      openFindings: openFindings || 0,
      lastScanLabel,
    };
  }, [data, loading, total]);

  const isEmpty = !loading && filteredData.length === 0;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={3}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Products
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Unified inventory coverage with risk posture at a glance.
            </Typography>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewChange}
              size="small"
              aria-label="view mode"
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.04),
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <ToggleButton value="grid" aria-label="grid view">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="list view">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", sm: 220 } }}
            />

            <Button
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
              sx={{ whiteSpace: "nowrap" }}
              onClick={handleUploadScan}
            >
              Upload scan
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon fontSize="small" />}
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "error.main",
              bgcolor: alpha(theme.palette.error.main, 0.1),
            }}
          >
            {error}
          </Alert>
        )}

        <Box>
          <Typography variant="overline" color="text.secondary">
            Overview
          </Typography>
          <ProductKpiRow
            loading={loading}
            totalProducts={metrics.totalProducts}
            productsAtRisk={metrics.productsAtRisk}
            openFindings={metrics.openFindings}
            lastScanLabel={metrics.lastScanLabel}
          />
        </Box>

        <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.08) }} />

        {loading ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                viewMode === "grid"
                  ? {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(3, minmax(0, 1fr))",
                      xl: "repeat(4, minmax(0, 1fr))",
                    }
                  : "1fr",
              gap: 2,
            }}
          >
            {Array.from({ length: viewMode === "grid" ? 6 : 8 }).map((_, index) => (
              <Box
                key={index}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: alpha(theme.palette.common.white, 0.02),
                }}
              >
                <Stack spacing={1.5}>
                  <Skeleton variant="text" width="40%" height={24} />
                  <Skeleton variant="text" width="60%" height={18} />
                  <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 2 }} />
                  <Skeleton variant="text" width="80%" height={18} />
                </Stack>
              </Box>
            ))}
          </Box>
        ) : isEmpty ? (
          <Box
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              p: { xs: 4, md: 6 },
              textAlign: "center",
              bgcolor: alpha(theme.palette.common.white, 0.02),
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.light,
                mb: 2,
              }}
            >
              <Inventory2OutlinedIcon />
            </Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              No products yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload your first scan to start building a live security inventory.
            </Typography>
            <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={handleUploadScan}>
              Upload first scan
            </Button>
          </Box>
        ) : viewMode === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {filteredData.map((item) => (
              <ProductGridCard
                key={item.id}
                product={item}
                onOpen={() => handleProductClick(item.id)}
                onViewFindings={() => handleViewFindings(item.id)}
                onUploadScan={handleUploadScan}
              />
            ))}
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {filteredData.map((item) => (
              <ProductListRow
                key={item.id}
                product={item}
                onOpen={() => handleProductClick(item.id)}
                onViewFindings={() => handleViewFindings(item.id)}
                onUploadScan={handleUploadScan}
              />
            ))}
          </Stack>
        )}

        <PaginationControl
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(0);
          }}
        />
      </Stack>
    </Container>
  );
};

export default ProductsList;
