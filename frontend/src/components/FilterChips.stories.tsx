import type { Meta, StoryObj } from "@storybook/react";
import { FilterChips } from "./FilterChips";

const meta: Meta<typeof FilterChips> = {
  title: "Filters/FilterChips",
  component: FilterChips,
  args: {
    productIds: [],
    search: "",
    severities: [],
    statuses: [],
    riskBands: [],
    occurrences: [],
    scannerTypes: [],
    policyDecisions: [],
    categories: [],
    datePreset: "",
    dateFrom: "",
    dateTo: "",
    showRepeats: false,
    onProductIdsChange: () => undefined,
    onSearchChange: () => undefined,
    onSeveritiesChange: () => undefined,
    onStatusesChange: () => undefined,
    onRiskBandsChange: () => undefined,
    onOccurrencesChange: () => undefined,
    onScannerTypesChange: () => undefined,
    onPolicyDecisionsChange: () => undefined,
    onCategoriesChange: () => undefined,
    onDatePresetChange: () => undefined,
    onDateFromChange: () => undefined,
    onDateToChange: () => undefined,
    onShowRepeatsChange: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof FilterChips>;

export const Empty: Story = {};

export const Basic: Story = {
  args: {
    severities: ["high"],
    statuses: ["new"],
  },
};

export const Full: Story = {
  args: {
    productIds: ["payments"],
    search: "jwt",
    severities: ["critical"],
    statuses: ["under_review"],
    riskBands: ["high"],
    occurrences: ["REPEAT"],
    scannerTypes: ["Trivy"],
    policyDecisions: ["warn"],
    categories: ["SAST"],
    dateFrom: "2024-03-01",
    showRepeats: true,
  },
};
