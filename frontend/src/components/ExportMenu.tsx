import {
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Download as DownloadIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { FindingListItemDTO } from "../types/findings";
import { getAuthHeaders } from "../api/http";
import { SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";

interface ExportMenuProps {
  data: FindingListItemDTO[];
  filename?: string;
  disabled?: boolean;

  /**
   * If provided, export will call the backend and download a file for the current filters.
   * `query` should not include `format` (it will be appended).
   */
  serverExport?: {
    path: string;
    query?: string; // e.g. "severity=high&product=..."
    total?: number;
    maxRows?: number; // safety cap shown to user (defaults to 20000)
  };
}

type ExportFormat = "csv" | "json";

const DEFAULT_SERVER_MAX = 20000;

const parseContentDispositionFilename = (value: string | null): string | null => {
  if (!value) return null;
  // Simple, safe parser for: attachment; filename="..."
  const match = value.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (!match) return null;
  const candidate = match[1].trim();
  // basic sanitization
  return candidate.replace(/[\\/\r\n]/g, "_").slice(0, 160);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ExportMenu = ({
  data,
  filename = "findings",
  disabled = false,
  serverExport,
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
      "Risk Score",
      "Risk Band",
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
      f.riskScore != null ? String(f.riskScore) : "",
      f.riskBand || "",
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
      riskScore: f.riskScore,
      riskBand: f.riskBand,
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

  const handleServerExport = async (format: ExportFormat) => {
    if (!serverExport) return;
    setExporting(true);
    try {
      const maxRows = serverExport.maxRows ?? DEFAULT_SERVER_MAX;
      const params = new URLSearchParams((serverExport.query || "").replace(/^\?/, ""));
      params.set("format", format);
      // export all filtered rows (bounded by maxRows)
      const wanted = typeof serverExport.total === "number" ? Math.max(0, serverExport.total) : maxRows;
      params.set("limit", String(Math.min(wanted, maxRows)));
      params.set("offset", "0");

      const url = `${serverExport.path}?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const cd = response.headers.get("content-disposition");
      const serverFilename = parseContentDispositionFilename(cd);
      const fallback = `${filename}_${new Date().toISOString().slice(0, 10)}.${format}`;
      downloadBlob(blob, serverFilename || fallback);
    } finally {
      setExporting(false);
      handleCloseMenu();
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const content = format === "csv" ? exportToCSV(data) : exportToJSON(data);
      downloadFile(content, format);
    } finally {
      setExporting(false);
      handleCloseMenu();
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpenMenu}
        startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
        disabled={disabled || exporting || (!serverExport && data.length === 0)}
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
        {serverExport && (
          <>
            <MenuItem onClick={() => handleServerExport("csv")}>
              <ListItemIcon>
                <CsvIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Export filtered (server) as CSV"
                secondary={`up to ${(serverExport.maxRows ?? DEFAULT_SERVER_MAX).toLocaleString()} rows`}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </MenuItem>
            <MenuItem onClick={() => handleServerExport("json")}>
              <ListItemIcon>
                <JsonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Export filtered (server) as JSON"
                secondary={`up to ${(serverExport.maxRows ?? DEFAULT_SERVER_MAX).toLocaleString()} rows`}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </MenuItem>
          </>
        )}

        <MenuItem onClick={() => handleExport("csv")}>
          <ListItemIcon>
            <CsvIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Export as CSV"
            secondary={`${data.length} findings`}
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
        <MenuItem onClick={() => handleExport("json")}>
          <ListItemIcon>
            <JsonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Export as JSON"
            secondary={`${data.length} findings`}
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportMenu;
