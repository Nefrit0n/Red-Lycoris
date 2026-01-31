import type { Meta, StoryObj } from "@storybook/react";
import ProductGridCard from "./ProductGridCard";
import { ProductWithStats } from "../types/products";

interface GridCardArgs {
  name: string;
  identifier?: string;
  version?: string;
  findingsOpenCount: number;
  lastScanAt?: string;
  newFindings: number;
  severityBreakdown: ProductWithStats["severityBreakdown"];
}

const meta: Meta<typeof ProductGridCard> = {
  title: "Products/ProductGridCard",
  component: ProductGridCard,
  args: {
    name: "Gateway API",
    identifier: "github.com/red-lycoris/gateway",
    version: "2.4.1",
    findingsOpenCount: 18,
    lastScanAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    newFindings: 4,
    severityBreakdown: {
      critical: 2,
      high: 5,
      medium: 6,
      low: 3,
      info: 2,
    },
  },
  argTypes: {
    severityBreakdown: { control: "object" },
    lastScanAt: { control: "text" },
    newFindings: { control: { type: "number", min: 0, max: 50 } },
  },
  render: (args: GridCardArgs) => (
    <ProductGridCard
      product={{
        id: "product-1",
        name: args.name,
        identifier: args.identifier,
        version: args.version,
        lastScanAt: args.lastScanAt,
        findingsOpenCount: args.findingsOpenCount,
        severityBreakdown: args.severityBreakdown,
        recentScans: args.lastScanAt
          ? [
              {
                id: "scan-1",
                scanner: "Snyk",
                status: "completed",
                createdAt: args.lastScanAt,
                findingsNew: args.newFindings,
              },
            ]
          : [],
      }}
    />
  ),
};

export default meta;

type Story = StoryObj<typeof ProductGridCard>;

export const Default: Story = {};

export const Stable: Story = {
  args: {
    name: "Edge Auth",
    findingsOpenCount: 0,
    severityBreakdown: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
  },
};
