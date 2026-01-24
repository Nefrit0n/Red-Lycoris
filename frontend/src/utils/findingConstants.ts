/**
 * Shared constants for findings
 */

import { FindingSeverity, FindingStatus, FindingOccurrenceStatus, RiskBand } from "../types/findings";

// Severity styles
export const SEVERITY_STYLES: Record<FindingSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "#2e7d32" },
  medium: { label: "Medium", color: "#ed6c02" },
  high: { label: "High", color: "#d32f2f" },
  critical: { label: "Critical", color: "#7b1fa2" },
};

// Severity chip styles for MUI Chip component
export const SEVERITY_CHIP_STYLES: Record<FindingSeverity, any> = {
  low: { borderColor: "success.main", color: "success.main" },
  medium: { borderColor: "warning.main", color: "warning.main" },
  high: { borderColor: "error.main", color: "error.main" },
  critical: { borderColor: "secondary.main", color: "secondary.main" },
};

// Status colors for Chip component
export const STATUS_COLORS: Record<FindingStatus, "default" | "info" | "success" | "warning"> = {
  new: "info",
  under_review: "warning",
  confirmed: "success",
  false_positive: "default",
  out_of_scope: "default",
  risk_accepted: "warning",
  mitigated: "success",
  duplicate: "default",
};

// Status labels
export const STATUS_LABELS: Record<FindingStatus, string> = {
  new: "New",
  under_review: "Under review",
  confirmed: "Confirmed",
  false_positive: "False positive",
  out_of_scope: "Out of scope",
  risk_accepted: "Risk accepted",
  mitigated: "Mitigated",
  duplicate: "Duplicate",
};

// Occurrence status labels
export const OCCURRENCE_LABELS: Record<FindingOccurrenceStatus, string> = {
  NEW: "New",
  REPEAT: "Repeated",
};

// Occurrence status colors for Chip component
export const OCCURRENCE_COLORS: Record<FindingOccurrenceStatus, "default" | "info" | "warning"> = {
  NEW: "default",
  REPEAT: "warning",
};

// All available statuses
export const ALL_STATUSES: FindingStatus[] = [
  "new",
  "under_review",
  "confirmed",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "mitigated",
  "duplicate",
];

// All available severities
export const ALL_SEVERITIES: FindingSeverity[] = ["low", "medium", "high", "critical"];

// All occurrence statuses
export const ALL_OCCURRENCES: FindingOccurrenceStatus[] = ["NEW", "REPEAT"];

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const RISK_BAND_COLORS: Record<RiskBand, string> = {
  low: "#2e7d32",
  medium: "#ed6c02",
  high: "#d32f2f",
  critical: "#7b1fa2",
};
