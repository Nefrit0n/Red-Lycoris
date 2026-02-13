import {
  Box,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

type BduPanelProps = {
  bdu: Record<string, unknown>;
};

type BduSoftwareRow = {
  vendor: string;
  product: string;
  version: string;
  type: string;
  platform: string;
};

type BduRef = { title: string; url: string };

type BduNormalized = {
  description: string;
  affectedSoftware: BduSoftwareRow[];
  cvss: Record<string, unknown>;
  severity: string;
  remediationSteps: string[];
  status: Record<string, unknown>;
  externalIds: Record<string, unknown>;
  references: BduRef[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(asText)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSoftware = (value: unknown): BduSoftwareRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      vendor: asText(item.vendor),
      product: asText(item.product),
      version: asText(item.version),
      type: asText(item.type),
      platform: asText(item.platform),
    }));
};

const normalizeRefs = (value: unknown): BduRef[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const url = asText(item.url);
    if (!url) return [];
    return [{ title: asText(item.title) || url, url }];
  });
};

const normalize = (value: unknown): BduNormalized => {
  const src = isRecord(value) ? value : {};
  return {
    description: asText(src.description),
    affectedSoftware: normalizeSoftware(src.affected_software),
    cvss: isRecord(src.cvss) ? src.cvss : {},
    severity: asText(src.severity),
    remediationSteps: toStringList(src.remediation_steps),
    status: isRecord(src.status) ? src.status : {},
    externalIds: isRecord(src.external_ids) ? src.external_ids : {},
    references: normalizeRefs(src.references),
  };
};

const renderInline = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(renderInline).filter(Boolean).join(", ");
  if (isRecord(value)) return Object.entries(value).map(([k, v]) => `${k}: ${renderInline(v)}`).join("; ");
  return asText(value) || "—";
};

export default function BduPanel({ bdu }: BduPanelProps) {
  const entries = Object.entries(bdu).map(([id, payload]) => ({ id, data: normalize(payload) }));

  return (
    <Stack spacing={2}>
      {entries.map(({ id, data }) => (
        <Box key={id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">{id}</Typography>

            <Box>
              <Typography variant="caption" color="text.secondary">Описание уязвимости</Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{data.description || "—"}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Уязвимое ПО</Typography>
              {data.affectedSoftware.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Platform</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.affectedSoftware.map((row, index) => (
                      <TableRow key={`${id}-${index}`}>
                        <TableCell>{row.vendor || "—"}</TableCell>
                        <TableCell>{row.product || "—"}</TableCell>
                        <TableCell>{row.version || "—"}</TableCell>
                        <TableCell>{row.type || "—"}</TableCell>
                        <TableCell>{row.platform || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2">—</Typography>
              )}
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">CVSS 2/3/4</Typography>
              <Typography variant="body2">v2: {renderInline(data.cvss.v2)}</Typography>
              <Typography variant="body2">v3: {renderInline(data.cvss.v3)}</Typography>
              <Typography variant="body2">v4: {renderInline(data.cvss.v4)}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Уровень опасности</Typography>
              <Typography variant="body2">{data.severity || "—"}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Меры устранения / компенсирующие меры</Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {data.remediationSteps.length > 0 ? data.remediationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "—"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Статус, дата публикации/обновления</Typography>
              <Typography variant="body2">Статус: {renderInline(data.status.value)}</Typography>
              <Typography variant="body2">Опубликовано: {renderInline(data.status.published_at)}</Typography>
              <Typography variant="body2">Обновлено: {renderInline(data.status.updated_at)}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Идентификаторы (CVE/FG-IR и т.д.)</Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {Object.keys(data.externalIds).length > 0
                  ? Object.entries(data.externalIds).map(([k, v]) => `${k}: ${renderInline(v)}`).join("\n")
                  : "—"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Ссылки</Typography>
              {data.references.length > 0 ? (
                <Stack spacing={0.5}>
                  {data.references.map((ref) => (
                    <MuiLink key={`${id}-${ref.url}`} href={ref.url} target="_blank" rel="noreferrer">
                      {ref.title}
                    </MuiLink>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2">—</Typography>
              )}
            </Box>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
