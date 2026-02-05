import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Box } from "@mui/material";
import FiltersPopover from "./FiltersPopover";
import { DEFAULT_FILTERS_STATE, FiltersState } from "../../filters/types";

const meta: Meta<typeof FiltersPopover> = {
  title: "Findings/Toolbar/FiltersPopover",
  component: FiltersPopover,
};

export default meta;

type Story = StoryObj<typeof FiltersPopover>;

const scannerOptions = [
  { value: "semgrep", label: "Semgrep" },
  { value: "trivy", label: "Trivy" },
  { value: "nuclei", label: "Nuclei" },
];

const productOptions = [
  { value: "prod-1", label: "Core Checkout" },
  { value: "prod-2", label: "Enterprise Billing Platform" },
  { value: "prod-3", label: "Internal Admin Portal" },
];

const FiltersPopoverDemo = (initialFilters: FiltersState) => {
  const Demo = () => {
    const [filters, setFilters] = useState<FiltersState>(initialFilters);

    return (
      <Box sx={{ p: 2, bgcolor: "#0b0b10" }}>
        <FiltersPopover
          filters={filters}
          activeCount={3}
          onApply={(next) => setFilters(next)}
          onClear={(next) => setFilters(next)}
          scannerOptionsOverride={scannerOptions}
          productOptionsOverride={productOptions}
        />
      </Box>
    );
  };

  return <Demo />;
};

export const Empty: Story = {
  render: () => FiltersPopoverDemo(DEFAULT_FILTERS_STATE),
};

export const Filled: Story = {
  render: () =>
    FiltersPopoverDemo({
      ...DEFAULT_FILTERS_STATE,
      severities: ["high", "critical"],
      statuses: ["new"],
      scannerTypes: ["semgrep", "trivy"],
      productIds: ["prod-1"],
      datePreset: "30d",
      showRepeats: true,
    }),
};

export const W1366LongNames: Story = {
  render: () => (
    <Box sx={{ width: 1366 }}>
      {FiltersPopoverDemo({
        ...DEFAULT_FILTERS_STATE,
        scannerTypes: ["very-long-scanner-name-with-multiple-words"],
        productIds: ["prod-2"],
      })}
    </Box>
  ),
};
