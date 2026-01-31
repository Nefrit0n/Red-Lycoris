import type { Meta, StoryObj } from "@storybook/react";
import ProductListRow from "./ProductListRow";
import { ProductWithStats } from "../types/products";

interface ListRowArgs {
  name: string;
  identifier?: string;
  version?: string;
  findingsOpenCount: number;
  lastScanAt?: string;
  severityBreakdown: ProductWithStats["severityBreakdown"];
}

const meta: Meta<typeof ProductListRow> = {
  title: "Products/ProductListRow",
  component: ProductListRow,
  args: {
    name: "Identity Service",
    identifier: "registry/internal/identity",
    version: "1.8.0",
    findingsOpenCount: 9,
    lastScanAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    severityBreakdown: {
      critical: 1,
      high: 2,
      medium: 4,
      low: 5,
      info: 1,
    },
  },
  argTypes: {
    severityBreakdown: { control: "object" },
    lastScanAt: { control: "text" },
  },
  render: (args: ListRowArgs) => (
    <ProductListRow
      product={{
        id: "product-2",
        name: args.name,
        identifier: args.identifier,
        version: args.version,
        lastScanAt: args.lastScanAt,
        findingsOpenCount: args.findingsOpenCount,
        severityBreakdown: args.severityBreakdown,
      }}
    />
  ),
};

export default meta;

type Story = StoryObj<typeof ProductListRow>;

export const Default: Story = {};

export const CriticalRisk: Story = {
  args: {
    findingsOpenCount: 38,
    severityBreakdown: {
      critical: 6,
      high: 10,
      medium: 12,
      low: 6,
      info: 4,
    },
  },
};
