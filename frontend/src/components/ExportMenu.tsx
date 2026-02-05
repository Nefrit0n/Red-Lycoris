import {
  Button,
  CircularProgress,
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
} from "@mui/icons-material";
import { useState } from "react";
import { FindingListItemDTO } from "../types/findings";
import { SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";
import { FiltersState } from "../types/filters";
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

type ExportFormat = "csv" | "json";

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

  const appendArray = (key: string, values: string[]) => {
    values.forEach((value) => params.append(key, value));
  };

  if (filters.productIds.length) appendArray("product", filters.productIds);
  if (filters.severities.length) appendArray("severity", filters.severities);
  if (filters.statuses.length) appendArray("status", filters.statuses);
  if (filters.riskBands.length) appendArray("riskBand", filters.riskBands);
  if (filters.occurrences.length) appendArray("occurrenceStatus", filters.occurrences);
  if (filters.scannerTypes.length) appendArray("scannerType", filters.scannerTypes);
  if (filters.policyDecisions.length) appendArray("policyDecision", filters.policyDecisions);
  if (filters.categories.length) appendArray("category", filters.categories);
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filters.importJobId) params.set("import_job_id", filters.importJobId);

  const dateFrom = normalizeDateFrom(filters.dateFrom);
  const dateTo = normalizeDateTo(filters.dateTo);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  params.set("canonicalOnly", String(!filters.showRepeats));
  params.set("includeRepeats", String(filters.showRepeats));

  // Note: backend export doesn't support sorting, so we don't include sortField/sortOrder

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
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Export using server-side streaming (for "select all matching" mode)
   */
  const handleServerExport = async (format: ExportFormat) => {
    if (!filters) return;

    setExporting(true);
    try {
      const url = buildExportUrl(format, filters, debouncedSearch);

      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Export failed:", response.status, errorText);
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.${format}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export error:", err);
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
              Exporting all {totalCount} findings
            </Typography>
          </Box>
        )}

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
      </Menu>
    </>
  );
};

export default ExportMenu;
