import React from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Package,
  Server,
  Shield,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CVSS31_METRICS,
  CVSS40_METRICS,
  CVSS_V2_METRICS,
  SEVERITY_CLASSES,
  type Severity,
} from "./cvss-metrics";
import CvssBreakdown from "./CvssBreakdown";

interface CvssBlock {
  score: number;
  vector?: string;
  metrics?: Record<string, string>;
}

function metricsFromVector(vector: string | undefined, order: string[]): Record<string, string> | undefined {
  if (!vector) return undefined;
  const metrics: Record<string, string> = {};
  const parts = vector.split("/");

  for (const part of parts) {
    const [key, value] = part.split(":");
    if (!key || !value) continue;
    if (key === "CVSS") continue;
    if (!order.includes(key)) continue;
    metrics[key] = value;
  }

  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function withFallbackMetrics(block: CvssBlock, order: string[]): CvssBlock {
  if (block.metrics && Object.keys(block.metrics).length > 0) {
    return block;
  }
  return {
    ...block,
    metrics: metricsFromVector(block.vector, order),
  };
}

export interface BduEntry {
  bdu_id: string;
  name: string;
  description?: string;
  severity?: string;

  vul_status?: string;
  exploit_status?: string;
  fix_status?: string;
  vul_class?: string;
  exploitation_way?: string;
  mitigation_way?: string;

  cvss_v2?: CvssBlock;
  cvss_v3?: CvssBlock;
  cvss_v4?: CvssBlock;

  software?: Array<{
    vendor?: string;
    name?: string;
    version?: string;
    types?: string[];
    platforms?: string[];
  }>;

  environment?: Array<{
    vendor?: string;
    name?: string;
  }>;

  sources?: string[];
  remediation?: string;
  matched_cve_id?: string;
  related_cve_ids?: string[];
  cwe_ids?: number[];
  published_at?: string;
  modified_at?: string;
}

function normalizeBDULink(id: string): string {
  return `https://bdu.fstec.ru/vul/${id.replace(/^BDU:/i, "")}`;
}

function statusTone(text: string): Severity {
  if (text === "Подтверждена производителем") return "low";
  return "neutral";
}

function exploitTone(text: string): Severity {
  if (text === "Существует в открытом доступе") return "critical";
  if (text === "Данных нет") return "neutral";
  return "medium";
}

function fixTone(text: string): Severity {
  if (text === "Уязвимость устранена") return "low";
  if (text === "Не устранена") return "high";
  return "neutral";
}

function groupByDomain(urls: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const url of urls) {
    try {
      const u = new URL(url);
      const domain = u.hostname.replace(/^www\./, "");
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(url);
    } catch {
      if (!groups["—"]) groups["—"] = [];
      groups["—"].push(url);
    }
  }
  return groups;
}

function renderWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    const matchRegex = /^https?:\/\/[^\s]+$/;
    if (matchRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300 underline break-all"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: Severity }) {
  return (
    <div className={cn("rounded-md border px-2 py-1 text-xs", SEVERITY_CLASSES[tone])}>
      <span className="text-zinc-400">{label}:</span> {value}
    </div>
  );
}

function BduEntryCard({ entry }: { entry: BduEntry }) {
  const bduLink = normalizeBDULink(entry.bdu_id);
  const sourceGroups = groupByDomain(entry.sources ?? []);
  const sourceDomains = Object.keys(sourceGroups).sort();

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-base">
              <a href={bduLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-red-300 hover:underline">
                {entry.bdu_id}
                <ExternalLink className="size-3.5" />
              </a>
            </CardTitle>
            {entry.vul_status && (
              <Badge className={cn("border", SEVERITY_CLASSES[statusTone(entry.vul_status)])}>
                {entry.vul_status}
              </Badge>
            )}
          </div>
          <a href={bduLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
            Оригинал на BDU
            <ExternalLink className="size-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-100">{entry.name}</h4>
          {entry.description && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{entry.description}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {entry.vul_class && <StatusPill label="Класс" value={entry.vul_class} tone="neutral" />}
          {entry.exploit_status && <StatusPill label="Эксплойт" value={entry.exploit_status} tone={exploitTone(entry.exploit_status)} />}
          {entry.fix_status && <StatusPill label="Статус" value={entry.fix_status} tone={fixTone(entry.fix_status)} />}
          {entry.mitigation_way && <StatusPill label="Устранение" value={entry.mitigation_way} tone="neutral" />}
          {entry.exploitation_way && <StatusPill label="Эксплуатация" value={entry.exploitation_way} tone="neutral" />}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {entry.cvss_v4 && (
            <CvssBreakdown
              label="CVSS 4.0"
              block={withFallbackMetrics(entry.cvss_v4, ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"])}
              dictionary={CVSS40_METRICS}
              order={["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"]}
            />
          )}
          {entry.cvss_v3 && (
            <CvssBreakdown
              label="CVSS 3.1"
              block={withFallbackMetrics(entry.cvss_v3, ["AV", "AC", "PR", "UI", "S", "C", "I", "A"])}
              dictionary={CVSS31_METRICS}
              order={["AV", "AC", "PR", "UI", "S", "C", "I", "A"]}
            />
          )}
          {entry.cvss_v2 && (
            <CvssBreakdown
              label="CVSS 2.0"
              block={withFallbackMetrics(entry.cvss_v2, ["AV", "AC", "Au", "C", "I", "A"])}
              dictionary={CVSS_V2_METRICS}
              order={["AV", "AC", "Au", "C", "I", "A"]}
            />
          )}
        </div>

        {entry.software && entry.software.length > 0 && (
          <Card className="border-zinc-800 bg-zinc-950/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 inline-flex items-center gap-2">
                <Package className="size-4" />
                Уязвимое ПО
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Вендор</th>
                    <th className="px-3 py-2 text-left">Название</th>
                    <th className="px-3 py-2 text-left">Версия</th>
                    <th className="px-3 py-2 text-left">Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.software.map((s, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-3 py-2 text-zinc-300">{s.vendor || "—"}</td>
                      <td className="px-3 py-2 text-zinc-100 font-medium">{s.name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-zinc-300">{s.version || "—"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{s.types?.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {entry.environment && entry.environment.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-200 inline-flex items-center gap-2"><Server className="size-4" />Операционные среды</h4>
            <ul className="space-y-1 text-sm text-zinc-300">
              {entry.environment.map((env, idx) => (
                <li key={idx}>• {[env.vendor, env.name].filter(Boolean).join(" ")}</li>
              ))}
            </ul>
          </div>
        )}

        {entry.cwe_ids && entry.cwe_ids.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-200 inline-flex items-center gap-2"><Shield className="size-4" />CWE</h4>
            <div className="flex flex-wrap gap-2">
              {entry.cwe_ids.map((cwe) => (
                <a key={cwe} href={`https://cwe.mitre.org/data/definitions/${cwe}.html`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:text-red-300">
                  CWE-{cwe}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {entry.remediation && (
          <div className="rounded-md border border-blue-800/50 bg-blue-950/20 p-3">
            <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-blue-300"><Wrench className="size-4" />Рекомендации</div>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{renderWithLinks(entry.remediation)}</p>
          </div>
        )}

        {sourceDomains.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-200 inline-flex items-center gap-2"><AlertTriangle className="size-4" />Ссылки на источники</h4>
            <div className="space-y-2">
              {sourceDomains.map((domain) => (
                <div key={domain} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="mb-1 text-sm text-zinc-200">▸ {domain} ({sourceGroups[domain].length})</div>
                  <ul className="space-y-1">
                    {sourceGroups[domain].map((url, idx) => (
                      <li key={`${url}-${idx}`}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-red-300 hover:underline">
                          {url}
                          <ExternalLink className="size-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {entry.related_cve_ids && entry.related_cve_ids.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-200">Связанные CVE</h4>
            <div className="flex flex-wrap gap-2">
              {entry.related_cve_ids.map((cve) => (
                <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 hover:text-red-300">
                  {cve}
                </a>
              ))}
            </div>
          </div>
        )}

        {(entry.published_at || entry.modified_at) && (
          <div className="space-y-1 text-xs text-zinc-500">
            {entry.published_at && (
              <div className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                Опубликована: {format(parseISO(entry.published_at), "d MMMM yyyy", { locale: ru })}
              </div>
            )}
            {entry.modified_at && (
              <div>
                Обновлена: {format(parseISO(entry.modified_at), "d MMMM yyyy", { locale: ru })} ({formatDistanceToNow(parseISO(entry.modified_at), { addSuffix: true, locale: ru })})
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BduSection({ entries }: { entries: BduEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Нет данных БДУ ФСТЭК для этой находки.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <BduEntryCard key={`${entry.bdu_id}-${entry.matched_cve_id ?? ""}`} entry={entry} />
      ))}
    </div>
  );
}
