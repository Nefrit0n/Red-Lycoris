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
import { SEVERITY_STYLES, STATUS_LABELS } from "../utils/findingConstants";

interface ExportMenuProps {
  data: FindingListItemDTO[];
  filename?: string;
  disabled?: boolean;
}

type ExportFormat = "csv" | "json";

const ExportMenu = ({ data, filename = "findings", disabled = false }: ExportMenuProps) => {
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
        disabled={disabled || data.length === 0 || exporting}
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
