import {
  Button,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Box,
} from "@mui/material";
import {
  Download as DownloadIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  CloudDownload as CloudDownloadIcon,
  Description as ReportIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { FindingListItemDTO } from "../types/findings";
import { SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";
import { FiltersState } from "../hooks/useUrlFiltersSync";
import { normalizeDateFrom, normalizeDateTo } from "../utils/urlHelpers";
import { getAuthHeaders } from "../api/http";

interface ExportMenuProps {
  data: FindingListItemDTO[];
  filename?: string;
  disabled?: boolean;
  /** Total count of matching findings (for select all) */
  totalCount?: number;
  /** Whether "select all matching" mode is active */
  selectAllMatching?: boolean;
  /** Current filters for server-side export */
  filters?: FiltersState;
  /** Debounced search value */
  debouncedSearch?: string;
}

type ExportFormat = "csv" | "json" | "sarif" | "cyclonedx" | "summary";

/**
 * Build export URL with all current filters
 */
const buildExportUrl = (
  format: ExportFormat,
  filters: FiltersState,
  debouncedSearch: string
): string => {
  const params = new URLSearchParams();
  params.set("format", format);
  params.set("limit", "20000"); // Max allowed by backend

  if (filters.productId) params.set("product", filters.productId);
  if (filters.filterSeverity) params.set("severity", filters.filterSeverity);
  if (filters.filterStatus) params.set("status", filters.filterStatus);
  if (filters.filterRiskBand) params.set("riskBand", filters.filterRiskBand);
  if (filters.filterOccurrence) params.set("occurrenceStatus", filters.filterOccurrence);
  if (filters.filterScannerType) params.set("scannerType", filters.filterScannerType);
  if (filters.filterPolicyDecision) params.set("policyDecision", filters.filterPolicyDecision);
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filters.importJobId) params.set("import_job_id", filters.importJobId);

  const dateFrom = normalizeDateFrom(filters.dateFrom);
  const dateTo = normalizeDateTo(filters.dateTo);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  params.set("canonicalOnly", String(!filters.showRepeats));
  params.set("includeRepeats", String(filters.showRepeats));

  if (filters.sortField) params.set("sortField", String(filters.sortField));
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

  return `/api/v1/findings/export?${params.toString()}`;
};

const ExportMenu = ({
  data,
  filename = "findings",
  disabled = false,
  totalCount = 0,
  selectAllMatching = false,
  filters,
  debouncedSearch = "",
}: ExportMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const exportToCSV = (findings: FindingListItemDTO[]): string => {
    const headers = [
      "ID",
      "Title",
      "Severity",
      "Status",
      "Product",
      "Scanner",
      "First Seen",
      "Last Seen",
      "Repeat Count",
    ];

    const rows = findings.map((f) => [
      f.id,
      `"${(f.title || "").replace(/"/g, '""')}"`,
      SEVERITY_STYLES[f.severity]?.label || f.severity,
      STATUS_LABELS[f.status] || f.status,
      f.productName || "",
      f.scannerType || "",
      f.firstSeenAt ? new Date(f.firstSeenAt).toISOString() : "",
      f.lastSeenAt ? new Date(f.lastSeenAt).toISOString() : "",
      f.repeatCount ?? 0,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  };

  const exportToJSON = (findings: FindingListItemDTO[]): string => {
    const exportData = findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      severityLabel: SEVERITY_STYLES[f.severity]?.label || f.severity,
      status: f.status,
      statusLabel: STATUS_LABELS[f.status] || f.status,
      productId: f.productId,
      productName: f.productName,
      scannerType: f.scannerType,
      firstSeenAt: f.firstSeenAt,
      lastSeenAt: f.lastSeenAt,
      repeatCount: f.repeatCount,
      occurrenceStatus: f.occurrenceStatus,
    }));

    return JSON.stringify(exportData, null, 2);
  };

  const downloadFile = (content: string, format: ExportFormat) => {
    const mimeTypes: Record<ExportFormat, string> = {
      csv: "text/csv;charset=utf-8;",
      json: "application/json;charset=utf-8;",
      sarif: "application/sarif+json;charset=utf-8;",
      cyclonedx: "application/vnd.cyclonedx+json;charset=utf-8;",
      summary: "text/plain;charset=utf-8;",
    };

    const extensions: Record<ExportFormat, string> = {
      csv: "csv",
      json: "json",
      sarif: "sarif.json",
      cyclonedx: "cdx.json",
      summary: "txt",
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.${extensions[format]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Export using server-side streaming (for "select all matching" mode)
   * Uses fetch with auth headers to fix 401 error
   */
  const handleServerExport = async (format: ExportFormat) => {
    if (!filters) return;

    setExporting(true);
    try {
      const url = buildExportUrl(format, filters, debouncedSearch);

      // Use fetch with auth headers
      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;

      // Determine file extension based on format
      const extensions: Record<ExportFormat, string> = {
        csv: "csv",
        json: "json",
        sarif: "sarif.json",
        cyclonedx: "cdx.json",
        summary: "txt",
      };
      link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.${extensions[format]}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export error:", err);
      // Could add toast notification here
    } finally {
      setTimeout(() => {
        setExporting(false);
        handleCloseMenu();
      }, 300);
    }
  };

  /**
   * Export client-side (for page data only)
   */
  const handleClientExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const content = format === "csv" ? exportToCSV(data) : exportToJSON(data);
      downloadFile(content, format);
    } finally {
      setExporting(false);
      handleCloseMenu();
    }
  };

  const handleExport = async (format: ExportFormat) => {
    // Use server export when "select all matching" is enabled and we have filters
    if (selectAllMatching && filters) {
      await handleServerExport(format);
    } else {
      await handleClientExport(format);
    }
  };

  // Determine what count to show
  const exportCount = selectAllMatching ? totalCount : data.length;
  const isServerExport = selectAllMatching && filters;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpenMenu}
        startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
        disabled={disabled || exportCount === 0 || exporting}
        sx={{ whiteSpace: "nowrap" }}
      >
        Export
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {isServerExport && (
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="primary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CloudDownloadIcon sx={{ fontSize: 14 }} />
              Export all {totalCount} findings
            </Typography>
          </Box>
        )}

        {/* Basic formats */}
        <MenuItem onClick={() => handleExport("csv")}>
          <ListItemIcon>
            <CsvIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="CSV"
            secondary="Spreadsheet format"
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
        <MenuItem onClick={() => handleExport("json")}>
          <ListItemIcon>
            <JsonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="JSON"
            secondary="Raw data export"
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Standard formats */}
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Security Standards
          </Typography>
        </Box>
        <MenuItem onClick={() => handleExport("sarif")} disabled={!isServerExport}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="SARIF"
            secondary="Static Analysis Results (OASIS)"
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
        <MenuItem onClick={() => handleExport("cyclonedx")} disabled={!isServerExport}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="CycloneDX"
            secondary="Software Bill of Materials"
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Reports */}
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Reports
          </Typography>
        </Box>
        <MenuItem onClick={() => handleExport("summary")} disabled={!isServerExport}>
          <ListItemIcon>
            <ReportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Executive Summary"
            secondary="PDF-ready text report"
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportMenu;
