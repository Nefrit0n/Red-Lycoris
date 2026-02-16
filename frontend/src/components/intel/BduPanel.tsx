import {
  Box,
  Chip,
  Divider,
  IconButton,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";

type BduPanelProps = {
  bdu: Record<string, unknown>;
};

/** Flat shape returned by the local bdu_vulnerabilities table. */
type BduLocal = {
  bdu_id: string;
  name: string;
  description: string;
  vendor: string;
  software_name: string;
  software_version: string;
  software_type: string;
  os_hardware: string;
  vuln_class: string;
  detection_date: string;
  cvss_v2: string;
  cvss_v3: string;
  cvss_v4: string;
  severity: string;
  remediation: string;
  status: string;
  exploit_exists: string;
  fix_info: string;
  source_urls: string;
  other_ids: string;
  other_info: string;
  incident_info: string;
  exploitation_method: string;
  fix_method: string;
  published_date: string;
  updated_date: string;
  consequences: string;
  vuln_state: string;
  cwe_description: string;
  cwe_id: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

/** Detect if payload is in the new local-DB flat format. */
const isLocalFormat = (v: unknown): v is BduLocal =>
  isRecord(v) && typeof (v as Record<string, unknown>).bdu_id === "string";

/** Normalize any payload shape into BduLocal. */
function toLocal(key: string, raw: unknown): BduLocal {
  if (isLocalFormat(raw)) return raw;
  // Legacy format from web scraping — map as best we can.
  const src = isRecord(raw) ? raw : {};
  return {
    bdu_id: str(src.identifier) || key,
    name: "",
    description: str(src.description),
    vendor: "",
    software_name: "",
    software_version: "",
    software_type: "",
    os_hardware: "",
    vuln_class: "",
    detection_date: "",
    cvss_v2: str(isRecord(src.cvss) ? (src.cvss as Record<string, unknown>).v2 : ""),
    cvss_v3: str(isRecord(src.cvss) ? (src.cvss as Record<string, unknown>).v3 : ""),
    cvss_v4: str(isRecord(src.cvss) ? (src.cvss as Record<string, unknown>).v4 : ""),
    severity: str(src.severity),
    remediation: Array.isArray(src.remediation_steps)
      ? (src.remediation_steps as unknown[]).map(str).join("\n")
      : "",
    status: str(isRecord(src.status) ? (src.status as Record<string, unknown>).value : ""),
    exploit_exists: "",
    fix_info: "",
    source_urls: "",
    other_ids: "",
    other_info: "",
    incident_info: "",
    exploitation_method: "",
    fix_method: "",
    published_date: str(isRecord(src.status) ? (src.status as Record<string, unknown>).published_at : ""),
    updated_date: str(isRecord(src.status) ? (src.status as Record<string, unknown>).updated_at : ""),
    consequences: "",
    vuln_state: "",
    cwe_description: "",
    cwe_id: "",
  };
}

function severityColor(severity: string): "error" | "warning" | "info" | "success" | "default" {
  const lower = severity.toLowerCase();
  if (lower.includes("критич")) return "error";
  if (lower.includes("высок")) return "warning";
  if (lower.includes("средн")) return "info";
  if (lower.includes("низк")) return "success";
  return "default";
}

function exploitColor(exploit: string): "error" | "warning" | "default" {
  const lower = exploit.toLowerCase();
  if (lower.includes("существует")) return "error";
  if (lower.includes("уточняются")) return "default";
  return "warning";
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 140 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

function BduEntry({ entry }: { entry: BduLocal }) {
  const [descOpen, setDescOpen] = useState(false);
  const bduUrl = `https://bdu.fstec.ru/vul/${entry.bdu_id.replace("BDU:", "")}`;
  const shortDesc = entry.description.length > 200
    ? entry.description.slice(0, 200) + "..."
    : entry.description;

  const sourceLinks = entry.source_urls
    ? entry.source_urls.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 2 }}>
      <Stack spacing={1.5}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <MuiLink href={bduUrl} target="_blank" rel="noreferrer" variant="subtitle2" sx={{ fontWeight: 700 }}>
            {entry.bdu_id}
          </MuiLink>
          {entry.severity && (
            <Chip label={entry.severity.split("(")[0].trim()} color={severityColor(entry.severity)} size="small" />
          )}
          {entry.exploit_exists && (
            <Chip
              label={entry.exploit_exists}
              color={exploitColor(entry.exploit_exists)}
              size="small"
              variant="outlined"
            />
          )}
          {entry.vuln_state && (
            <Chip label={entry.vuln_state} size="small" variant="outlined" />
          )}
        </Box>

        {/* Title */}
        {entry.name && (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.name}</Typography>
        )}

        {/* Description — collapsible */}
        {entry.description && (
          <Box>
            <Typography variant="caption" color="text.secondary">Описание</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
              {descOpen ? entry.description : shortDesc}
            </Typography>
            {entry.description.length > 200 && (
              <IconButton size="small" onClick={() => setDescOpen(!descOpen)} sx={{ fontSize: 12, p: 0 }}>
                <Typography variant="caption" color="primary">{descOpen ? "Свернуть" : "Показать полностью"}</Typography>
              </IconButton>
            )}
          </Box>
        )}

        <Divider />

        {/* Key info grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
          <Field label="Статус" value={entry.status} />
          <Field label="CWE" value={entry.cwe_id ? `${entry.cwe_id} — ${entry.cwe_description}` : entry.cwe_description} />
          <Field label="Класс" value={entry.vuln_class} />
          <Field label="Способ эксплуатации" value={entry.exploitation_method} />
        </Box>

        {/* CVSS */}
        {(entry.cvss_v2 || entry.cvss_v3 || entry.cvss_v4) && (
          <Box>
            <Typography variant="caption" color="text.secondary">CVSS</Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {entry.cvss_v2 && <Chip label={`v2: ${entry.cvss_v2}`} size="small" variant="outlined" />}
              {entry.cvss_v3 && <Chip label={`v3: ${entry.cvss_v3}`} size="small" variant="outlined" />}
              {entry.cvss_v4 && <Chip label={`v4: ${entry.cvss_v4}`} size="small" variant="outlined" />}
            </Box>
          </Box>
        )}

        {/* Software */}
        {(entry.vendor || entry.software_name) && (
          <Box>
            <Typography variant="caption" color="text.secondary">Уязвимое ПО</Typography>
            <Typography variant="body2">
              {[entry.vendor, entry.software_name, entry.software_version].filter(Boolean).join(" / ")}
              {entry.software_type ? ` (${entry.software_type})` : ""}
            </Typography>
            {entry.os_hardware && (
              <Typography variant="body2" color="text.secondary">{entry.os_hardware}</Typography>
            )}
          </Box>
        )}

        {/* Remediation */}
        {(entry.remediation || entry.fix_info || entry.fix_method) && (
          <Box>
            <Typography variant="caption" color="text.secondary">Устранение</Typography>
            {entry.fix_info && <Typography variant="body2">{entry.fix_info}</Typography>}
            {entry.fix_method && <Field label="Способ" value={entry.fix_method} />}
            {entry.remediation && (
              <Typography variant="body2" sx={{ whiteSpace: "pre-line", mt: 0.5 }}>{entry.remediation}</Typography>
            )}
          </Box>
        )}

        {/* Consequences */}
        <Field label="Последствия" value={entry.consequences} />

        {/* Dates */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {entry.detection_date && (
            <Typography variant="caption" color="text.secondary">Выявлена: {entry.detection_date}</Typography>
          )}
          {entry.published_date && (
            <Typography variant="caption" color="text.secondary">Опубликована: {entry.published_date}</Typography>
          )}
          {entry.updated_date && (
            <Typography variant="caption" color="text.secondary">Обновлена: {entry.updated_date}</Typography>
          )}
        </Box>

        {/* Other IDs */}
        {entry.other_ids && (
          <Box>
            <Typography variant="caption" color="text.secondary">Идентификаторы</Typography>
            <Typography variant="body2">{entry.other_ids}</Typography>
          </Box>
        )}

        {/* Source links */}
        {sourceLinks.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">Источники</Typography>
            <Stack spacing={0.25}>
              {sourceLinks.slice(0, 5).map((url) => (
                <MuiLink key={url} href={url} target="_blank" rel="noreferrer" variant="body2" sx={{ wordBreak: "break-all" }}>
                  {url}
                </MuiLink>
              ))}
              {sourceLinks.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ...и ещё {sourceLinks.length - 5}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

export default function BduPanel({ bdu }: BduPanelProps) {
  const entries = Object.entries(bdu).map(([key, payload]) => toLocal(key, payload));

  if (entries.length === 0) {
    return <Typography variant="body2" color="text.secondary">Данные БДУ ФСТЭК отсутствуют</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        Найдено записей: {entries.length}
      </Typography>
      {entries.map((entry) => (
        <BduEntry key={entry.bdu_id} entry={entry} />
      ))}
    </Stack>
  );
}
