import type { Meta, StoryObj } from "@storybook/react";
import ProductCard, { ProductCardData } from "./ProductCard";

const baseProduct: ProductCardData = {
  id: "product-legacy",
  name: "Legacy Checkout",
  identifier: "github.com/red-lycoris/checkout",
  version: "3.2.0",
  lastScanAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  findingsOpenCount: 12,
  severityBreakdown: {
    critical: 1,
    high: 3,
    medium: 4,
    low: 3,
    info: 1,
  },
};

const meta: Meta<typeof ProductCard> = {
  title: "Products/ProductCard",
  component: ProductCard,
  args: {
    product: baseProduct,
  },
};

export default meta;

type Story = StoryObj<typeof ProductCard>;

export const Healthy: Story = {
  args: {
    product: {
      ...baseProduct,
      name: "Portal Gateway",
      findingsOpenCount: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    },
  },
};

export const AtRisk: Story = {
  args: {
    product: {
      ...baseProduct,
      name: "Identity Service",
      findingsOpenCount: 42,
      severityBreakdown: {
        critical: 4,
        high: 8,
        medium: 10,
        low: 12,
        info: 8,
      },
    },
  },
};

export const NoRepoLinked: Story = {
  args: {
    product: {
      ...baseProduct,
      name: "Edge Worker",
      identifier: null,
      version: null,
    },
  },
};

export const NoScans: Story = {
  args: {
    product: {
      ...baseProduct,
      name: "Telemetry Agent",
      lastScanAt: null,
      findingsOpenCount: 0,
      severityBreakdown: undefined,
    },
  },
};

export const HasNewFindings: Story = {
  args: {
    product: {
      ...baseProduct,
      name: "Risk Analyzer",
      latestScanFindingsNew: 6,
    },
  },
};
