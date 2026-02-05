import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import FilterDrawer, { DraftFiltersState } from "./FilterDrawer";

const baseDraft: DraftFiltersState = {
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
};

type DemoProps = Omit<ComponentProps<typeof FilterDrawer>, "draftFilters" | "setDraftFilters"> & {
  draftFilters?: DraftFiltersState;
};

const Demo = (props: DemoProps) => {
  const [draft, setDraft] = useState<DraftFiltersState>(props.draftFilters ?? baseDraft);

  return (
    <FilterDrawer
      {...props}
      draftFilters={draft}
      setDraftFilters={setDraft}
    />
  );
};

const meta: Meta<typeof FilterDrawer> = {
  title: "Filters/FilterDrawer",
  component: FilterDrawer,
  args: {
    open: true,
    onClose: () => undefined,
    onReset: () => undefined,
    onApply: () => undefined,
    draftFilters: baseDraft,
    setDraftFilters: () => undefined,
    activeCount: 0,
    onSaveView: () => undefined,
  },
  render: (args) => {
    const { setDraftFilters: _unused, ...rest } = args;
    return <Demo {...rest} />;
  },
};

export default meta;

type Story = StoryObj<typeof FilterDrawer>;

export const Empty: Story = {
  args: {
    activeCount: 0,
    draftFilters: baseDraft,
  },
};

export const Filled: Story = {
  args: {
    activeCount: 6,
    draftFilters: {
      ...baseDraft,
      search: "jwt",
      filterSeverity: "high",
      filterStatus: "under_review",
      filterScannerType: "Trivy",
      filterPolicyDecision: "warn",
      dateFrom: "2024-03-01",
    },
  },
};

export const WithPresets: Story = {
  args: {
    activeCount: 3,
    draftFilters: {
      ...baseDraft,
      filterStatus: "new",
      filterSeverity: "critical",
      filterScannerType: "SAST",
    },
  },
};
