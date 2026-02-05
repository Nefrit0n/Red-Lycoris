import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import FiltersPanel from "./FiltersPanel";
import {
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";

const meta: Meta<typeof FiltersPanel> = {
  title: "Filters/FiltersPanel",
  component: FiltersPanel,
};

export default meta;

type Story = StoryObj<typeof FiltersPanel>;

const Demo = () => {
  const [productId, setProductId] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<FindingSeverity | "">("");
  const [filterStatus, setFilterStatus] = useState<FindingStatus | "">("");
  const [filterRiskBand, setFilterRiskBand] = useState<RiskBand | "">("");
  const [filterOccurrence, setFilterOccurrence] = useState<FindingOccurrenceStatus | "">("");
  const [filterScannerType, setFilterScannerType] = useState("");
  const [filterPolicyDecision, setFilterPolicyDecision] = useState<PolicyDecision | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRepeats, setShowRepeats] = useState(false);

  const handleReset = () => {
    setProductId("");
    setProductLabel("");
    setSearch("");
    setFilterSeverity("");
    setFilterStatus("");
    setFilterRiskBand("");
    setFilterOccurrence("");
    setFilterScannerType("");
    setFilterPolicyDecision("");
    setDateFrom("");
    setDateTo("");
    setShowRepeats(false);
  };

  return (
    <FiltersPanel
      productId={productId}
      productLabel={productLabel}
      search={search}
      filterSeverity={filterSeverity}
      filterStatus={filterStatus}
      filterRiskBand={filterRiskBand}
      filterOccurrence={filterOccurrence}
      filterScannerType={filterScannerType}
      filterPolicyDecision={filterPolicyDecision}
      dateFrom={dateFrom}
      dateTo={dateTo}
      showRepeats={showRepeats}
      severityCounts={{ low: 12, medium: 8, high: 4, critical: 2 }}
      statusCounts={{ new: 5, under_review: 3, confirmed: 2, false_positive: 1 }}
      onProductIdChange={setProductId}
      onProductLabelChange={setProductLabel}
      onSearchChange={setSearch}
      onSeverityChange={setFilterSeverity}
      onStatusChange={setFilterStatus}
      onRiskBandChange={setFilterRiskBand}
      onOccurrenceChange={setFilterOccurrence}
      onScannerTypeChange={setFilterScannerType}
      onPolicyDecisionChange={setFilterPolicyDecision}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onShowRepeatsChange={setShowRepeats}
      onReset={handleReset}
      showChips
    />
  );
};

export const DemoPanel: Story = {
  render: () => <Demo />,
};
