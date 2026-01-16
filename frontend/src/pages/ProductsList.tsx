import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProducts } from "../api/products";
import PaginationControl from "../components/PaginationControl";
import { Product } from "../types/products";

const ProductsList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchProducts(pageSize, page * pageSize, signal);
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
    [page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Products
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Inventory продуктов и актуальные показатели по находкам.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Identifier</TableCell>
                <TableCell>Последний скан</TableCell>
                <TableCell>Открытые находки</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      Продуктов пока нет.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      {item.name}
                      {item.version ? ` (${item.version})` : ""}
                    </TableCell>
                    <TableCell>{item.identifier || "—"}</TableCell>
                    <TableCell>
                      {item.lastScanAt ? new Date(item.lastScanAt).toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell>{item.findingsOpenCount}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="primary"
                        sx={{ cursor: "pointer" }}
                        onClick={() =>
                          navigate({
                            pathname: "/findings",
                            search: `?productId=${item.id}`,
                          })
                        }
                      >
                        Открыть findings
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

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
