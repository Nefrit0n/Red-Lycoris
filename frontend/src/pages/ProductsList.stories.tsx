import type { Meta, StoryObj } from "@storybook/react";
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  InputAdornment,
} from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { ProductWithStats } from "../types/products";
import ProductGridCard from "../components/ProductGridCard";
import ProductKpiRow from "../components/ProductKpiRow";
import ProductListRow from "../components/ProductListRow";

const sampleProducts: ProductWithStats[] = [
  {
    id: "prod-1",
    name: "Gateway API",
    identifier: "github.com/red-lycoris/gateway",
    version: "2.4.1",
    lastScanAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    findingsOpenCount: 24,
    severityBreakdown: { critical: 2, high: 6, medium: 8, low: 6, info: 2 },
    recentScans: [
      {
        id: "scan-1",
        scanner: "Snyk",
        status: "completed",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        findingsNew: 5,
      },
    ],
  },
  {
    id: "prod-2",
    name: "Identity Service",
    identifier: "registry/internal/identity",
    version: "1.8.0",
    lastScanAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    findingsOpenCount: 11,
    severityBreakdown: { critical: 0, high: 1, medium: 4, low: 4, info: 2 },
    recentScans: [
      {
        id: "scan-2",
        scanner: "Trivy",
        status: "completed",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        findingsNew: 0,
      },
    ],
  },
  {
    id: "prod-3",
    name: "Telemetry Agent",
    identifier: null,
    version: null,
    lastScanAt: null,
    findingsOpenCount: 0,
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    recentScans: [],
  },
];

const ProductsListStory = ({ viewMode = "grid" }: { viewMode: "grid" | "list" }) => (
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

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
          <ToggleButtonGroup value={viewMode} exclusive size="small" aria-label="view mode">
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            placeholder="Search products"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Button variant="contained" startIcon={<UploadFileOutlinedIcon />}>
            Upload scan
          </Button>
        </Stack>
      </Stack>

      <Box>
        <Typography variant="overline" color="text.secondary">
          Overview
        </Typography>
        <ProductKpiRow
          totalProducts={24}
          productsAtRisk={6}
          openFindings={182}
          lastScanLabel="Updated 2h ago"
        />
      </Box>

      {viewMode === "grid" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {sampleProducts.map((product) => (
            <ProductGridCard key={product.id} product={product} />
          ))}
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {sampleProducts.map((product) => (
            <ProductListRow key={product.id} product={product} />
          ))}
        </Stack>
      )}
    </Stack>
  </Container>
);

const meta: Meta<typeof ProductsListStory> = {
  title: "Pages/ProductsList",
  component: ProductsListStory,
  parameters: { layout: "fullscreen" },
  args: {
    viewMode: "grid",
  },
  argTypes: {
    viewMode: { control: { type: "radio" }, options: ["grid", "list"] },
  },
};

export default meta;

type Story = StoryObj<typeof ProductsListStory>;

export const Default: Story = {};

export const ListView: Story = {
  args: {
    viewMode: "list",
  },
};
