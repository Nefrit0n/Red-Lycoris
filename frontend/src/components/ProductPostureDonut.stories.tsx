import type { Meta, StoryObj } from "@storybook/react";
import ProductPostureDonut from "./ProductPostureDonut";

const meta: Meta<typeof ProductPostureDonut> = {
  title: "Products/ProductPostureDonut",
  component: ProductPostureDonut,
  args: {
    breakdown: {
      critical: 2,
      high: 4,
      medium: 8,
      low: 12,
      info: 6,
    },
    size: 72,
    thickness: 10,
    showCenterLabel: true,
  },
  argTypes: {
    breakdown: { control: "object" },
    size: { control: { type: "number", min: 48, max: 120, step: 4 } },
    thickness: { control: { type: "number", min: 6, max: 18, step: 2 } },
  },
};

export default meta;

type Story = StoryObj<typeof ProductPostureDonut>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    breakdown: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
  },
};
