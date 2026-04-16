import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { AlertTriangle, Calendar, ExternalLink, Package, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OsvRangeEvent {
  type: string;
  version: string;
}

interface OsvRange {
  type: string;
  repo?: string;
  events: OsvRangeEvent[];
  introduced_in?: string;
  fixed_in?: string;
  last_affected?: string;
}

interface OsvSeverityItem {
  type?: string;
  score?: string;
}

export interface OsvEntry {
  osv_id: string;
  summary: string;
  details?: string;
  aliases?: string[];
  ecosystem?: string;
  package_name?: string;
  fixed_versions?: string[];
  introduced_versions?: string[];
  has_fix?: boolean;
  ranges?: OsvRange[];
  severity?: unknown;
  references?: unknown;
  published_at?: string;
  modified_at?: string;
  match_type?: "cve" | "package_fallback";
}

function aliasLink(alias: string): string {
  if (alias.startsWith("CVE-")) return `https://nvd.nist.gov/vuln/detail/${alias}`;
  if (alias.startsWith("GHSA-")) return `https://github.com/advisories/${alias}`;
  if (alias.startsWith("PYSEC-")) return `https://osv.dev/vulnerability/${alias}`;
  if (alias.startsWith("RUSTSEC-")) return `https://rustsec.org/advisories/${alias}.html`;
  if (alias.startsWith("GO-")) return `https://pkg.go.dev/vuln/${alias}`;
  return `https://osv.dev/vulnerability/${alias}`;
}

function aliasGroup(alias: string): string {
  if (alias.startsWith("CVE-")) return "CVE";
  if (alias.startsWith("GHSA-")) return "GHSA";
  if (alias.startsWith("PYSEC-")) return "PYSEC";
  if (alias.startsWith("RUSTSEC-")) return "RUSTSEC";
  if (alias.startsWith("MAL-")) return "MAL";
  if (alias.startsWith("GO-")) return "GO";
  return "Другие";
}

function advisoryLink(osvID: string): string {
  if (osvID.startsWith("GHSA-")) {
    return `https://github.com/advisories/${osvID}`;
  }
  return `https://osv.dev/vulnerability/${osvID}`;
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: ru });
  } catch {
    return value;
  }
}

function parseSeverity(raw: unknown): OsvSeverityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is OsvSeverityItem => typeof v === "object" && v !== null);
}

function OsvEntryCard({ entry, findingComponent }: { entry: OsvEntry; findingComponent?: string }) {
  const fixedVersions = entry.fixed_versions ?? [];
  const introducedVersions = entry.introduced_versions ?? [];
  const ranges = entry.ranges ?? [];
  const aliases = entry.aliases ?? [];
  const severityItems = parseSeverity(entry.severity);

  const aliasGroups = aliases.reduce<Record<string, string[]>>((acc, alias) => {
    const key = aliasGroup(alias);
    acc[key] = acc[key] ?? [];
    acc[key].push(alias);
    return acc;
  }, {});

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="space-y-4 pt-5">
        {entry.match_type === "package_fallback" && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              Связь по названию пакета — не подтверждена через CVE. Проверьте, относится ли этот advisory к вашей
              находке.
            </div>
          </div>
        )}

        {entry.has_fix ? (
          <Card className="border-emerald-700/60 bg-emerald-950/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-emerald-300">
                <Wrench className="size-4" />
                Обновление доступно
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono text-emerald-200">
                {fixedVersions.length === 1
                  ? `Обновитесь до ${fixedVersions[0]}`
                  : `Обновитесь до одной из: ${fixedVersions.join(", ")}`}
              </div>
              {introducedVersions.length > 0 && (
                <div className="mt-2 text-xs text-zinc-400">
                  Уязвимость появилась в версии {introducedVersions.join(", ")}
                </div>
              )}
              {findingComponent && fixedVersions.length > 0 && (
                <div className="mt-2 text-sm text-zinc-300">
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5">{findingComponent}</code>
                  {" → "}
                  <code className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-emerald-200">
                    {findingComponent.split("@")[0]}@{fixedVersions[0]}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-700/50 bg-amber-950/30">
            <CardContent className="flex items-start gap-2 py-3 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                Патч пока недоступен. Следите за advisory
                {entry.ranges?.[0]?.last_affected && <> (последняя затронутая: {entry.ranges[0].last_affected})</>}.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={advisoryLink(entry.osv_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-red-300 hover:underline"
            >
              {entry.osv_id}
              <ExternalLink className="size-3.5" />
            </a>
            {entry.ecosystem && <Badge className="border-zinc-700 bg-zinc-900 text-zinc-300">{entry.ecosystem}</Badge>}
          </div>
          <h4 className="text-sm font-medium text-zinc-100">{entry.summary}</h4>
        </div>

        <div className="space-y-1 text-xs text-zinc-400">
          {(entry.ecosystem || entry.package_name) && (
            <div className="flex items-center gap-2">
              <Package className="size-3.5" />
              <code>{entry.ecosystem ?? "—"} / {entry.package_name ?? "—"}</code>
            </div>
          )}
          {entry.modified_at && (
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5" />
              <span>Модифицировано: {formatDate(entry.modified_at)}</span>
            </div>
          )}
        </div>

        {Object.keys(aliasGroups).length > 0 && (
          <div className="space-y-2">
            {Object.entries(aliasGroups).map(([group, groupAliases]) => (
              <div key={group} className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs text-zinc-500">{group}:</span>
                {groupAliases.map((alias) => (
                  <a
                    key={alias}
                    href={aliasLink(alias)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <Badge className="border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-200 hover:border-zinc-500">
                      {alias}
                    </Badge>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        {ranges.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">Все диапазоны ({ranges.length})</summary>
            <div className="mt-2 space-y-2">
              {ranges.map((r, i) => (
                <div key={i} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2 text-xs">
                  <div className="font-mono text-zinc-400">Type: {r.type}</div>
                  {r.repo && <div className="font-mono text-zinc-500">Repo: {r.repo}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.events.map((ev, j) => (
                      <span key={j} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">
                        {ev.type}: {ev.version}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {entry.details && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">Подробное описание</summary>
            <div className="mt-2 whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">
              {entry.details}
            </div>
          </details>
        )}

        {severityItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {severityItems.map((s, i) => (
              <span key={`${s.type ?? "unknown"}-${i}`} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs">
                {(s.type ?? "unknown")}: {s.score ?? "n/a"}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OsvSection({
  entries,
  findingComponent,
}: {
  entries: OsvEntry[];
  findingComponent?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Нет данных OSV для этой находки
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <OsvEntryCard key={entry.osv_id} entry={entry} findingComponent={findingComponent} />
      ))}
    </div>
  );
}
