import type { Meta, StoryObj } from "@storybook/react";
import ProductKpiRow from "./ProductKpiRow";

const meta: Meta<typeof ProductKpiRow> = {
  title: "Products/ProductKpiRow",
  component: ProductKpiRow,
  args: {
    loading: false,
    totalProducts: 24,
    productsAtRisk: 6,
    openFindings: 182,
    lastScanLabel: "Updated 2h ago",
  },
  argTypes: {
    lastScanLabel: { control: "text" },
  },
};

export default meta;

type Story = StoryObj<typeof ProductKpiRow>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
    totalProducts: null,
    productsAtRisk: null,
    openFindings: null,
    lastScanLabel: null,
  },
};
