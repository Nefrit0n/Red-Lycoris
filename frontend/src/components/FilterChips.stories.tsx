import type { Meta, StoryObj } from "@storybook/react";
import { FilterChips } from "./FilterChips";

const meta: Meta<typeof FilterChips> = {
  title: "Filters/FilterChips",
  component: FilterChips,
  args: {
    productId: "",
    productLabel: "",
    search: "",
    filterSeverity: "",
    filterStatus: "",
    filterRiskBand: "",
    filterOccurrence: "",
    filterScannerType: "",
    filterPolicyDecision: "",
    dateFrom: "",
    dateTo: "",
    showRepeats: false,
    onProductIdChange: () => undefined,
    onSearchChange: () => undefined,
    onSeverityChange: () => undefined,
    onStatusChange: () => undefined,
    onRiskBandChange: () => undefined,
    onOccurrenceChange: () => undefined,
    onScannerTypeChange: () => undefined,
    onPolicyDecisionChange: () => undefined,
    onDateFromChange: () => undefined,
    onDateToChange: () => undefined,
    onShowRepeatsChange: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof FilterChips>;

export const Empty: Story = {};

export const ThreeChips: Story = {
  args: {
    filterSeverity: "high",
    filterStatus: "new",
    search: "jwt",
    onResetAll: () => undefined,
  },
};

export const TenChips: Story = {
  args: {
    productId: "payments",
    productLabel: "Платежи",
    search: "xss",
    filterSeverity: "critical",
    filterStatus: "under_review",
    filterRiskBand: "high",
    filterOccurrence: "REPEAT",
    filterScannerType: "Trivy",
    filterPolicyDecision: "warn",
    dateFrom: "2024-02-01",
    dateTo: "2024-03-20",
    showRepeats: true,
    onResetAll: () => undefined,
  },
};
