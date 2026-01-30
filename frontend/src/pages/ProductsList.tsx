import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchProducts, fetchProductsWithStats } from "../api/products";
import PaginationControl from "../components/PaginationControl";
import ProductCard, { ProductCardData } from "../components/ProductCard";
import DataTable, { TableEmptyState, TableLoadingRows } from "../components/DataTable";
import { ProductWithStats } from "../types/products";

type ViewMode = "table" | "cards";

const ProductsList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ProductWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // View mode from URL or localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const urlView = searchParams.get("view") as ViewMode;
    if (urlView === "table" || urlView === "cards") return urlView;
    const stored = localStorage.getItem("productsViewMode") as ViewMode;
    return stored === "cards" ? "cards" : "table";
  });

  const handleViewChange = (_: React.MouseEvent, newView: ViewMode | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem("productsViewMode", newView);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("view", newView);
      setSearchParams(newParams, { replace: true });
    }
  };

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        // Use fetchProductsWithStats for cards view to get severity breakdown
        const response =
          viewMode === "cards"
            ? await fetchProductsWithStats(pageSize, page * pageSize, signal)
            : await fetchProducts(pageSize, page * pageSize, signal);
        setData(response.data);
        setTotal(response.total);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Не удалось загрузить список продуктов.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, viewMode]
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

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Products
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Inventory продуктов и актуальные показатели по находкам.
          </Typography>
        </Box>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
          aria-label="view mode"
        >
          <ToggleButton value="table" aria-label="table view">
            <Tooltip title="Таблица">
              <ViewListIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="cards" aria-label="cards view">
            <Tooltip title="Карточки">
              <ViewModuleIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {viewMode === "cards" ? (
        /* Cards View */
        <Box>
          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : data.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: "center", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography color="text.secondary">Продуктов пока нет.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {data.map((item) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
                  <ProductCard
                    product={item as ProductCardData}
                    onClick={() => handleProductClick(item.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      ) : (
        /* Table View */
        <DataTable minWidth={860}>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Identifier</TableCell>
              <TableCell>Последний скан</TableCell>
              <TableCell>Открытые находки</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableLoadingRows rowCount={6} cellCount={5} />
            ) : data.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                title="Нет продуктов"
                description="Загрузите первый продукт или выберите другой проект."
                hint="Можно начать с загрузки скана или импорта."
              />
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleProductClick(item.id)}
                >
                  <TableCell>
                    {item.name}
                    {item.version ? ` (${item.version})` : ""}
                  </TableCell>
                  <TableCell>{item.identifier || "—"}</TableCell>
                  <TableCell>
                    {item.lastScanAt ? new Date(item.lastScanAt).toLocaleString("ru-RU") : "—"}
                  </TableCell>
                  <TableCell>{item.findingsOpenCount}</TableCell>
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    <Tooltip title="Открыть findings">
                      <IconButton
                        size="small"
                        onClick={() => handleViewFindings(item.id)}
                        aria-label="Открыть findings"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </DataTable>
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
    </Container>
  );
};

export default ProductsList;
