import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  downloadSbom,
  listProductBduVulnerabilities,
  listProductComponents,
  listSboms,
  uploadSbom,
} from "../../api/sbom";
import { GlassCard } from "../../design-system/components";
import { tableStyles } from "../../design-system/utils/tableStyles";
import type { BDUMatchItem } from "../../types/bdu";
import type { SbomComponentItem, SbomIndexStatus, SbomItem } from "../../types/sbom";

interface SbomSectionProps {
  productId: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatScanDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const formatIndexStatus = (
  status?: SbomIndexStatus | null,
): { label: string; color: "default" | "success" | "warning" | "error" } => {
  if (!status) return { label: "no SBOM", color: "default" };
  switch (status.status) {
    case "indexed":
    case "done":
      return { label: "ready", color: "success" };
    case "processing":
      return { label: "indexing", color: "warning" };
    case "queued":
    case "pending":
      return { label: "queued", color: "warning" };
    case "failed":
      return { label: "failed", color: "error" };
    default:
      return { label: status.status || "unknown", color: "default" };
  }
};

export const SbomSection = ({ productId }: SbomSectionProps) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [sboms, setSboms] = useState<SbomItem[]>([]);
  const [sbomLoading, setSbomLoading] = useState(false);
  const [sbomError, setSbomError] = useState<string | null>(null);
  const [sbomUploading, setSbomUploading] = useState(false);
  const [sbomUploadError, setSbomUploadError] = useState<string | null>(null);
  const [components, setComponents] = useState<SbomComponentItem[]>([]);
  const [componentsTotal, setComponentsTotal] = useState(0);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [componentsFilters, setComponentsFilters] = useState({
    directOnly: false,
    ecosystem: "",
    license: "",
    q: "",
  });
  const [indexStatus, setIndexStatus] = useState<SbomIndexStatus | null>(null);

  const [bduItems, setBduItems] = useState<BDUMatchItem[]>([]);
  const [bduTotal, setBduTotal] = useState(0);
  const [bduLoading, setBduLoading] = useState(false);
  const [bduError, setBduError] = useState<string | null>(null);
  const [bduSearch, setBduSearch] = useState("");

  const fetchSboms = useCallback(async () => {
    setSbomLoading(true);
    setSbomError(null);
    try {
      const items = await listSboms(productId);
      setSboms(items);
    } catch (err) {
      setSbomError(err instanceof Error ? err.message : "Failed to load SBOMs");
    } finally {
      setSbomLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (tabIndex !== 0) return;
    fetchSboms();
  }, [fetchSboms, tabIndex]);

  const fetchComponents = useCallback(async () => {
    setComponentsLoading(true);
    setComponentsError(null);
    try {
      const response = await listProductComponents(productId, {
        directOnly: componentsFilters.directOnly,
        ecosystem: componentsFilters.ecosystem || undefined,
        license: componentsFilters.license || undefined,
        q: componentsFilters.q || undefined,
        limit: 200,
        offset: 0,
      });
      setComponents(response.items);
      setComponentsTotal(response.total);
      setIndexStatus(response.indexStatus ?? null);
    } catch (err) {
      setComponentsError(err instanceof Error ? err.message : "Failed to load components");
    } finally {
      setComponentsLoading(false);
    }
  }, [componentsFilters, productId]);

  useEffect(() => {
    if (tabIndex !== 1) return;
    fetchComponents();
  }, [fetchComponents, tabIndex]);

  useEffect(() => {
    if (tabIndex !== 1) return;
    if (!indexStatus) return;
    const s = indexStatus.status;
    if (s !== "queued" && s !== "processing" && s !== "pending") return;
    const interval = window.setInterval(() => {
      if (!document.hidden) fetchComponents();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [tabIndex, indexStatus?.status, fetchComponents]);

  const fetchBdu = useCallback(async () => {
    setBduLoading(true);
    setBduError(null);
    try {
      const response = await listProductBduVulnerabilities(productId, {
        q: bduSearch || undefined,
        limit: 200,
        offset: 0,
      });
      setBduItems(response.items ?? []);
      setBduTotal(response.total);
    } catch (err) {
      setBduError(err instanceof Error ? err.message : "Failed to load BDU vulnerabilities");
    } finally {
      setBduLoading(false);
    }
  }, [bduSearch, productId]);

  useEffect(() => {
    if (tabIndex !== 2) return;
    fetchBdu();
  }, [fetchBdu, tabIndex]);

  const handleSbomUpload = async (file: File) => {
    setSbomUploading(true);
    setSbomUploadError(null);
    try {
      await uploadSbom(productId, file);
      await fetchSboms();
    } catch (err) {
      setSbomUploadError(err instanceof Error ? err.message : "Failed to upload SBOM");
    } finally {
      setSbomUploading(false);
    }
  };

  const handleSbomDownload = async (item: SbomItem) => {
    try {
      await downloadSbom(item.id, item.originalFilename);
    } catch (err) {
      setSbomError(err instanceof Error ? err.message : "Failed to download SBOM");
    }
  };

  const statusChip = formatIndexStatus(indexStatus);

  return (
    <GlassCard variant="subtle" padding="comfortable">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">SBOM & Components</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage SBOMs and indexed components.
          </Typography>
        </Box>
        <Tabs
          value={tabIndex}
          onChange={(_, value) => setTabIndex(value)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="SBOM" />
          <Tab label="Components" />
          <Tab label="БДУ ФСТЭК" />
        </Tabs>

        {tabIndex === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Supported formats: CycloneDX, SPDX, SPDX JSON.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <Button variant="contained" component="label" disabled={sbomUploading}>
                {sbomUploading ? "Uploading..." : "Upload SBOM"}
                <input
                  type="file"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleSbomUpload(file);
                    event.target.value = "";
                  }}
                />
              </Button>
              <Button variant="outlined" onClick={fetchSboms} disabled={sbomLoading}>
                Refresh list
              </Button>
            </Stack>
            {sbomUploadError && <Alert severity="error">{sbomUploadError}</Alert>}
            {sbomError && <Alert severity="error">{sbomError}</Alert>}
            {sbomLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            ) : sboms.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No SBOM uploads yet.
              </Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                  <Box component="thead">
                    <Box component="tr">
                      {["File", "Format", "Size", "SHA256", "Indexed", "Components", "Created", ""].map(
                        (label) => (
                          <Box
                            key={label}
                            component="th"
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              padding: "10px 8px",
                              color: tableStyles.headerText,
                              borderBottom: `1px solid ${tableStyles.cellBorder}`,
                              background: tableStyles.headerBg,
                            }}
                          >
                            {label}
                          </Box>
                        ),
                      )}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {sboms.map((item) => (
                      <Box key={item.id} component="tr">
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.originalFilename}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.format}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {formatBytes(item.sizeBytes)}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                            {item.sha256}
                          </Typography>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Chip
                            size="small"
                            label={item.indexStatus || "pending"}
                            color={
                              item.indexStatus === "indexed"
                                ? "success"
                                : item.indexStatus === "failed"
                                  ? "error"
                                  : "warning"
                            }
                          />
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.componentCount ?? 0}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.createdAt ? formatScanDate(item.createdAt) : "\u2014"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Button size="small" variant="outlined" onClick={() => handleSbomDownload(item)}>
                            Download
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
          </Stack>
        )}

        {tabIndex === 1 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <Chip label={`Status: ${statusChip.label}`} color={statusChip.color} />
              {indexStatus?.error && (
                <Typography variant="body2" color="error">
                  {indexStatus.error}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Components: {componentsTotal}
              </Typography>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Search"
                size="small"
                value={componentsFilters.q}
                onChange={(event) => setComponentsFilters((prev) => ({ ...prev, q: event.target.value }))}
              />
              <TextField
                label="Ecosystem"
                size="small"
                value={componentsFilters.ecosystem}
                onChange={(event) =>
                  setComponentsFilters((prev) => ({ ...prev, ecosystem: event.target.value }))
                }
              />
              <TextField
                label="License contains"
                size="small"
                value={componentsFilters.license}
                onChange={(event) =>
                  setComponentsFilters((prev) => ({ ...prev, license: event.target.value }))
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={componentsFilters.directOnly}
                    onChange={(event) =>
                      setComponentsFilters((prev) => ({ ...prev, directOnly: event.target.checked }))
                    }
                  />
                }
                label="Direct only"
              />
              <Button variant="outlined" onClick={fetchComponents} disabled={componentsLoading}>
                Refresh
              </Button>
            </Stack>
            {componentsError && <Alert severity="error">{componentsError}</Alert>}
            {componentsLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            ) : components.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No components found.
              </Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                  <Box component="thead">
                    <Box component="tr">
                      {["Name", "Version", "Ecosystem", "Direct", "Vulns", "Licenses"].map((label) => (
                        <Box
                          key={label}
                          component="th"
                          style={{
                            fontWeight: 600,
                            fontSize: 12,
                            padding: "10px 8px",
                            color: tableStyles.headerText,
                            borderBottom: `1px solid ${tableStyles.cellBorder}`,
                            background: tableStyles.headerBg,
                          }}
                        >
                          {label}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {components.map((item) => (
                      <Box key={item.id} component="tr">
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">{item.name}</Typography>
                            {item.purl && (
                              <Typography variant="caption" color="text.secondary">
                                {item.purl}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.version || "\u2014"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.ecosystem || "\u2014"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.direct ? "Yes" : "No"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.vulnTotal > 0 ? (
                            <Stack spacing={0.25}>
                              <Typography variant="body2">{item.vulnTotal}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                C/H/M/L: {item.vulnCritical}/{item.vulnHigh}/{item.vulnMedium}/{item.vulnLow}
                              </Typography>
                            </Stack>
                          ) : (
                            "0"
                          )}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {(item.licenses || []).join(", ") || "\u2014"}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Total: {componentsTotal}
                </Typography>
              </Box>
            )}
          </Stack>
        )}

        {tabIndex === 2 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Matched: {bduTotal}
              </Typography>
              <TextField
                label="Search (BDU ID, name, component)"
                size="small"
                value={bduSearch}
                onChange={(event) => setBduSearch(event.target.value)}
                sx={{ minWidth: 280 }}
              />
              <Button variant="outlined" onClick={fetchBdu} disabled={bduLoading}>
                Refresh
              </Button>
            </Stack>
            {bduError && <Alert severity="error">{bduError}</Alert>}
            {bduLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            ) : bduItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No BDU FSTEC matches found for SBOM components.
              </Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                  <Box component="thead">
                    <Box component="tr">
                      {[
                        "Component",
                        "BDU ID",
                        "Name",
                        "Severity",
                        "CVSS v3",
                        "BDU Version",
                        "Exploit",
                        "Status",
                        "CWE",
                        "Vendor",
                      ].map((label) => (
                        <Box
                          key={label}
                          component="th"
                          style={{
                            fontWeight: 600,
                            fontSize: 12,
                            padding: "10px 8px",
                            color: tableStyles.headerText,
                            borderBottom: `1px solid ${tableStyles.cellBorder}`,
                            background: tableStyles.headerBg,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {bduItems.map((item, idx) => (
                      <Box key={`${item.bduId}-${item.componentName}-${item.componentVersion}-${idx}`} component="tr">
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">{item.componentName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.componentVersion}
                            </Typography>
                          </Stack>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {item.bduId}
                          </Typography>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13, maxWidth: 300 }}>
                          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                            {item.name}
                          </Typography>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          <Chip
                            size="small"
                            label={item.severity || "—"}
                            color={
                              item.severity.includes("Критич")
                                ? "error"
                                : item.severity.includes("Высок")
                                  ? "warning"
                                  : item.severity.includes("Средн")
                                    ? "info"
                                    : "default"
                            }
                          />
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.cvssV3 || "—"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13, maxWidth: 250 }}>
                          <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                            {item.softwareVersion}
                          </Typography>
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.exploitExists || "—"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.status || "—"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.cweId || "—"}
                        </Box>
                        <Box component="td" style={{ padding: "10px 8px", fontSize: 13 }}>
                          {item.vendor || "—"}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Total: {bduTotal}
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </GlassCard>
  );
};
