import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Box } from "@mui/material";
import FindingsTopBar from "./FindingsTopBar";
import { DEFAULT_FILTERS_STATE, FiltersState } from "../../filters/types";

const meta: Meta<typeof FindingsTopBar> = {
  title: "Findings/Toolbar/FindingsTopBar",
  component: FindingsTopBar,
};

export default meta;

type Story = StoryObj<typeof FindingsTopBar>;

const TopBarDemo = (initialFilters: FiltersState) => {
  const Demo = () => {
    const [filters, setFilters] = useState<FiltersState>(initialFilters);

    const handleApplyView = (partial: Partial<FiltersState>) => {
      setFilters((prev) => ({ ...prev, ...partial }));
    };

    return (
      <Box sx={{ bgcolor: "#0b0b10" }}>
        <FindingsTopBar
          totalKnown
          totalCount={128}
          filters={filters}
          onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          onApplyView={handleApplyView}
          exportData={[]}
          exportDisabled
          exportTotalCount={128}
          exportSelectAllMatching={false}
          debouncedSearch={filters.search}
          categoryItemsOverride={[
            { category: "SAST", count: 12 },
            { category: "SCA", count: 8 },
            { category: "DAST", count: 4 },
            { category: "SECRETS", count: 6 },
            { category: "CONTAINER", count: 3 },
            { category: "IAC", count: 2 },
          ]}
        />
      </Box>
    );
  };

  return <Demo />;
};

export const Empty: Story = {
  render: () => TopBarDemo(DEFAULT_FILTERS_STATE),
};

export const Filled: Story = {
  render: () =>
    TopBarDemo({
      ...DEFAULT_FILTERS_STATE,
      search: "gateway",
      severities: ["critical", "high"],
      statuses: ["new", "under_review"],
      categories: ["SAST", "SCA", "DAST"],
      scannerTypes: ["semgrep", "trivy", "nuclei"],
      productIds: ["Payments API", "Core Checkout"],
      occurrences: ["NEW"],
      riskBands: ["high"],
      policyDecisions: ["fail"],
      datePreset: "7d",
      showRepeats: true,
    }),
};

export const W1366LongNames: Story = {
  render: () => (
    <Box sx={{ width: 1366 }}>
      {TopBarDemo({
        ...DEFAULT_FILTERS_STATE,
        search: "very long search query value",
        productIds: ["Super Long Product Name - Enterprise Billing Platform"],
        scannerTypes: ["very-long-scanner-name-with-multiple-words"],
        categories: ["SECRETS", "IAC", "CONTAINER"],
        severities: ["medium"],
      })}
    </Box>
  ),
};
