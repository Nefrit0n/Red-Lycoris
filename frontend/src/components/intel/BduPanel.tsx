import {
  Box,
  Chip,
  Collapse,
  Link as MuiLink,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { useState } from "react";
import { primitives, semantic } from "../../design-system/tokens/colors";

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

function toLocal(_key: string, raw: unknown): BduLocal | null {
  if (isRecord(raw) && typeof (raw as Record<string, unknown>).bdu_id === "string") {
    return raw as BduLocal;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Severity → design-system semantic color
// ---------------------------------------------------------------------------
function severityToken(severity: string) {
  const s = severity.toLowerCase();
  if (s.includes("критич")) return { color: semantic.severity.critical.base, bg: semantic.severity.critical.subtle, label: "Критический" };
  if (s.includes("высок")) return { color: semantic.severity.high.base, bg: semantic.severity.high.subtle, label: "Высокий" };
  if (s.includes("средн")) return { color: semantic.severity.medium.base, bg: semantic.severity.medium.subtle, label: "Средний" };
  if (s.includes("низк")) return { color: semantic.severity.low.base, bg: semantic.severity.low.subtle, label: "Низкий" };
  return { color: primitives.night[400], bg: alpha(primitives.night[400], 0.12), label: severity };
}

function exploitToken(exploit: string) {
  const s = exploit.toLowerCase();
  if (s.includes("существует")) return { color: semantic.feedback.error.base, bg: semantic.feedback.error.subtle };
  if (s.includes("уточняются")) return { color: primitives.night[400], bg: alpha(primitives.night[400], 0.1) };
  return { color: semantic.feedback.warning.base, bg: semantic.feedback.warning.subtle };
}

// ---------------------------------------------------------------------------
// CVSS score → color
// ---------------------------------------------------------------------------
function cvssColor(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return primitives.night[300];
  if (num >= 9) return semantic.severity.critical.base;
  if (num >= 7) return semantic.severity.high.base;
  if (num >= 4) return semantic.severity.medium.base;
  return semantic.severity.low.base;
}

// ---------------------------------------------------------------------------
// Parse other_ids into individual identifier chips
// ---------------------------------------------------------------------------
function parseIdentifiers(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

function identifierUrl(id: string): string | null {
  if (/^CVE-\d{4}-\d+$/i.test(id)) return `https://nvd.nist.gov/vuln/detail/${id.toUpperCase()}`;
  if (/^CWE-\d+$/i.test(id)) return `https://cwe.mitre.org/data/definitions/${id.replace(/\D/g, "")}.html`;
  return null;
}

// ---------------------------------------------------------------------------
// Key-value field (consistent with FindingDetail style)
// ---------------------------------------------------------------------------
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <Stack direction="row" gap={1} sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: primitives.night[500], fontSize: "0.65rem", flexShrink: 0, minWidth: 140, pt: 0.25 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: primitives.night[200],
          whiteSpace: "pre-line",
          wordBreak: "break-word",
          ...(mono ? { fontFamily: "monospace", fontSize: "0.8rem" } : {}),
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section header
// ---------------------------------------------------------------------------
function SectionHeader({
  title,
  expanded,
  onToggle,
  badge,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        py: 0.75,
        px: 1.5,
        cursor: "pointer",
        borderTop: "1px solid",
        borderColor: alpha(primitives.night[600], 0.3),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        "&:hover": { bgcolor: alpha(primitives.night[700], 0.3) },
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="caption" sx={{ color: primitives.night[400], fontSize: "0.7rem", fontWeight: 600 }}>
          {title}
        </Typography>
        {badge && (
          <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
            {badge}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" sx={{ color: primitives.night[500] }}>
        {expanded ? "−" : "+"}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Single BDU entry card
// ---------------------------------------------------------------------------
function BduEntry({ entry }: { entry: BduLocal }) {
  const [descOpen, setDescOpen] = useState(false);
  const [softwareOpen, setSoftwareOpen] = useState(false);
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [idsOpen, setIdsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const bduUrl = `https://bdu.fstec.ru/vul/${entry.bdu_id.replace("BDU:", "")}`;
  const sev = severityToken(entry.severity);
  const shortDesc = entry.description.length > 300
    ? entry.description.slice(0, 300) + "..."
    : entry.description;
  const sourceLinks = entry.source_urls
    ? entry.source_urls.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const identifiers = parseIdentifiers(entry.other_ids);
  const hasSoftware = Boolean(entry.vendor || entry.software_name || entry.os_hardware);
  const hasRemediation = Boolean(entry.remediation || entry.fix_info || entry.fix_method);

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: alpha(primitives.night[600], 0.5),
        overflow: "hidden",
      }}
    >
      {/* ── Summary header ── */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: alpha(primitives.night[700], 0.25),
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {/* BDU ID */}
        <MuiLink
          href={bduUrl}
          target="_blank"
          rel="noreferrer"
          sx={{
            fontWeight: 700,
            fontSize: "0.875rem",
            color: primitives.night[50],
            textDecoration: "none",
            "&:hover": { color: primitives.lotus[400] },
          }}
        >
          {entry.bdu_id}
        </MuiLink>

        {/* Severity badge */}
        {entry.severity && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontWeight: 700,
              color: sev.color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: sev.bg,
              fontSize: "0.65rem",
            }}
          >
            {sev.label}
          </Typography>
        )}

        {/* CVSS scores inline */}
        {entry.cvss_v3 && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: cvssColor(entry.cvss_v3),
              fontSize: "0.75rem",
            }}
          >
            CVSS 3: {entry.cvss_v3}
          </Typography>
        )}
        {entry.cvss_v2 && !entry.cvss_v3 && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: cvssColor(entry.cvss_v2),
              fontSize: "0.75rem",
            }}
          >
            CVSS 2: {entry.cvss_v2}
          </Typography>
        )}

        {/* Exploit status */}
        {entry.exploit_exists && (() => {
          const exp = exploitToken(entry.exploit_exists);
          return (
            <Typography
              component="span"
              variant="caption"
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: exp.bg,
                color: exp.color,
                fontSize: "0.65rem",
                fontWeight: 600,
              }}
            >
              {entry.exploit_exists}
            </Typography>
          );
        })()}

        {/* Vuln state */}
        {entry.vuln_state && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(primitives.night[600], 0.3),
              color: primitives.night[300],
              fontSize: "0.65rem",
            }}
          >
            {entry.vuln_state}
          </Typography>
        )}

        {/* Dates — push to the right */}
        <Box sx={{ flex: 1 }} />
        {entry.published_date && (
          <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
            {entry.published_date}
          </Typography>
        )}
      </Box>

      {/* ── Title ── */}
      {entry.name && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: primitives.night[200] }}>
            {entry.name}
          </Typography>
        </Box>
      )}

      {/* ── Key info grid ── */}
      <Box sx={{ px: 2, py: 1 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
          <Field label="Статус" value={entry.status} />
          <Field label="Класс" value={entry.vuln_class} />
          <Field
            label="CWE"
            value={entry.cwe_id ? `${entry.cwe_id} — ${entry.cwe_description}` : entry.cwe_description}
          />
          <Field label="Способ эксплуатации" value={entry.exploitation_method} />
          {entry.consequences && <Field label="Последствия" value={entry.consequences} />}
        </Box>
      </Box>

      {/* ── Collapsible sections ── */}
      <Stack spacing={0}>
        {/* Description */}
        {entry.description && (
          <>
            <SectionHeader title="Описание" expanded={descOpen} onToggle={() => setDescOpen(!descOpen)} />
            <Collapse in={descOpen}>
              <Box sx={{ px: 2, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-line", color: primitives.night[200], lineHeight: 1.6 }}>
                  {entry.description}
                </Typography>
              </Box>
            </Collapse>
          </>
        )}

        {/* CVSS details */}
        {(entry.cvss_v2 || entry.cvss_v3 || entry.cvss_v4) && (
          <>
            <SectionHeader
              title="CVSS"
              expanded={false}
              badge={[
                entry.cvss_v4 ? `v4: ${entry.cvss_v4}` : "",
                entry.cvss_v3 ? `v3: ${entry.cvss_v3}` : "",
                entry.cvss_v2 ? `v2: ${entry.cvss_v2}` : "",
              ].filter(Boolean).join(" · ")}
              onToggle={() => {}}
            />
          </>
        )}

        {/* Software & Environment */}
        {hasSoftware && (
          <>
            <SectionHeader
              title="ПО и окружение"
              expanded={softwareOpen}
              onToggle={() => setSoftwareOpen(!softwareOpen)}
              badge={[entry.vendor, entry.software_name].filter(Boolean).join(" / ")}
            />
            <Collapse in={softwareOpen}>
              <Box sx={{ px: 2, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
                <Stack spacing={0.5}>
                  <Field label="Вендор" value={entry.vendor} />
                  <Field label="ПО" value={entry.software_name} />
                  <Field label="Версия" value={entry.software_version} />
                  <Field label="Тип" value={entry.software_type} />
                  <Field label="ОС / Оборудование" value={entry.os_hardware} />
                </Stack>
              </Box>
            </Collapse>
          </>
        )}

        {/* Remediation */}
        {hasRemediation && (
          <>
            <SectionHeader
              title="Устранение"
              expanded={remediationOpen}
              onToggle={() => setRemediationOpen(!remediationOpen)}
            />
            <Collapse in={remediationOpen}>
              <Box sx={{ px: 2, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
                <Stack spacing={0.5}>
                  <Field label="Информация" value={entry.fix_info} />
                  <Field label="Способ устранения" value={entry.fix_method} />
                  {entry.remediation && (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-line", color: primitives.night[200], mt: 0.5 }}>
                      {entry.remediation}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Collapse>
          </>
        )}

        {/* Identifiers */}
        {identifiers.length > 0 && (
          <>
            <SectionHeader
              title="Идентификаторы"
              expanded={idsOpen}
              onToggle={() => setIdsOpen(!idsOpen)}
              badge={`${identifiers.length}`}
            />
            <Collapse in={idsOpen}>
              <Box sx={{ px: 2, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {identifiers.map((id) => {
                    const url = identifierUrl(id);
                    return url ? (
                      <Chip
                        key={id}
                        label={id}
                        size="small"
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          height: 22,
                          color: primitives.night[200],
                          borderColor: alpha(primitives.night[500], 0.4),
                          "&:hover": { color: primitives.lotus[400], borderColor: primitives.lotus[500] },
                        }}
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        key={id}
                        label={id}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          height: 22,
                          color: primitives.night[300],
                          borderColor: alpha(primitives.night[500], 0.3),
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            </Collapse>
          </>
        )}

        {/* Source links */}
        {sourceLinks.length > 0 && (
          <>
            <SectionHeader
              title="Источники"
              expanded={sourcesOpen}
              onToggle={() => setSourcesOpen(!sourcesOpen)}
              badge={`${sourceLinks.length}`}
            />
            <Collapse in={sourcesOpen}>
              <Box sx={{ px: 2, py: 1, bgcolor: alpha(primitives.night[700], 0.15) }}>
                <Stack spacing={0.25}>
                  {sourceLinks.map((url) => (
                    <MuiLink
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        fontSize: "0.75rem",
                        color: primitives.night[300],
                        textDecoration: "none",
                        "&:hover": { color: primitives.lotus[400] },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {url}
                    </MuiLink>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </>
        )}

        {/* Dates footer */}
        <Box
          sx={{
            px: 2,
            py: 0.75,
            borderTop: "1px solid",
            borderColor: alpha(primitives.night[600], 0.3),
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {entry.detection_date && (
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Выявлена: {entry.detection_date}
            </Typography>
          )}
          {entry.published_date && (
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Опубликована: {entry.published_date}
            </Typography>
          )}
          {entry.updated_date && (
            <Typography variant="caption" sx={{ color: primitives.night[500], fontSize: "0.65rem" }}>
              Обновлена: {entry.updated_date}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export default function BduPanel({ bdu }: BduPanelProps) {
  const entries = Object.entries(bdu)
    .map(([key, payload]) => toLocal(key, payload))
    .filter((entry): entry is BduLocal => entry !== null);

  if (entries.length === 0) {
    return <Typography variant="body2" sx={{ color: primitives.night[400] }}>Данные БДУ ФСТЭК отсутствуют</Typography>;
  }

  return (
    <Stack spacing={2}>
      {entries.length > 1 && (
        <Typography variant="caption" sx={{ color: primitives.night[500] }}>
          Найдено записей: {entries.length}
        </Typography>
      )}
      {entries.map((entry) => (
        <BduEntry key={entry.bdu_id} entry={entry} />
      ))}
    </Stack>
  );
}
