import React from "react";
import { Shield, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASSES } from "./cvss-metrics";

export interface CweMitigation {
  phases: string[];
  description: string;
}

export interface CweParentEntry {
  cwe_id: number;
  name: string;
  category?: string;
}

export interface CweEntry {
  cwe_id: number;
  name: string;
  description: string;
  extended_description?: string;
  category?: string;
  likelihood?: string;
  impact?: string;
  mitigations?: CweMitigation[];
  parent_chain?: CweParentEntry[];
  owasp_top10?: { id: string; name: string };
  cwe_top25_rank?: number;
}

function categoryBadgeClass(category?: string): string {
  switch (category) {
    case "Base":
      return SEVERITY_CLASSES.medium;
    case "Variant":
      return SEVERITY_CLASSES.low;
    case "Class":
      return SEVERITY_CLASSES.high;
    case "Compound":
      return SEVERITY_CLASSES.critical;
    default:
      return SEVERITY_CLASSES.neutral;
  }
}

function likelihoodBadgeClass(likelihood?: string): string {
  switch (likelihood) {
    case "High":
      return SEVERITY_CLASSES.critical;
    case "Medium":
      return SEVERITY_CLASSES.medium;
    case "Low":
      return SEVERITY_CLASSES.low;
    default:
      return SEVERITY_CLASSES.neutral;
  }
}

function CweEntryCard({ entry }: { entry: CweEntry }) {
  const fullChain: Array<{ cwe_id: number; name: string }> = [
    ...(entry.parent_chain ? [...entry.parent_chain].reverse() : []),
    { cwe_id: entry.cwe_id, name: entry.name },
  ];

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        {/* 1. ЗАГОЛОВОК */}
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <a
                href={`https://cwe.mitre.org/data/definitions/${entry.cwe_id}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-red-300 hover:underline"
              >
                CWE-{entry.cwe_id}
                <ExternalLink className="size-3.5" />
              </a>
              <span className="font-medium text-zinc-100">{entry.name}</span>
            </CardTitle>
          </div>
          {entry.category && (
            <Badge className={cn("shrink-0", categoryBadgeClass(entry.category))}>
              {entry.category}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 2. COMPLIANCE-БЕЙДЖИ */}
        {(entry.owasp_top10 || entry.cwe_top25_rank !== undefined) && (
          <div className="flex flex-wrap items-center gap-2">
            {entry.owasp_top10 && (
              <>
                <Badge className="gap-1 border-purple-700/60 bg-purple-950/60 text-purple-300">
                  <Shield className="size-3" />
                  OWASP {entry.owasp_top10.id}
                </Badge>
                <span className="text-xs text-zinc-400">{entry.owasp_top10.name}</span>
              </>
            )}
            {entry.cwe_top25_rank !== undefined && (
              <Badge className="gap-1 border-orange-700/60 bg-orange-950/60 text-orange-300">
                #{entry.cwe_top25_rank} CWE Top 25
              </Badge>
            )}
          </div>
        )}

        {/* 3. LIKELIHOOD + IMPACT */}
        {(entry.likelihood || entry.impact) && (
          <div className="flex flex-wrap items-center gap-2">
            {entry.likelihood && (
              <Badge className={likelihoodBadgeClass(entry.likelihood)}>
                Likelihood: {entry.likelihood}
              </Badge>
            )}
            {entry.impact && (
              <Tooltip content={entry.impact}>
                <span className="max-w-xs truncate text-xs text-zinc-400 cursor-default">
                  {entry.impact}
                </span>
              </Tooltip>
            )}
          </div>
        )}

        {/* 4. ИЕРАРХИЯ (breadcrumb) */}
        {fullChain.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {fullChain.map((item, i) => (
              <React.Fragment key={item.cwe_id}>
                {i > 0 && <span className="text-zinc-600">→</span>}
                <Tooltip content={item.name}>
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${item.cwe_id}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono",
                      i === fullChain.length - 1
                        ? "bg-zinc-700 text-zinc-100 font-medium"
                        : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    CWE-{item.cwe_id}
                  </a>
                </Tooltip>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* 5. ОПИСАНИЕ */}
        {entry.description && (
          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed text-zinc-300">{entry.description}</p>
            {entry.extended_description && (
              <details className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
                  ▸ Расширенное описание
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {entry.extended_description}
                </p>
              </details>
            )}
          </div>
        )}

        {/* 6. MITIGATIONS */}
        {entry.mitigations && entry.mitigations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">Меры по устранению</h4>
            <div className="space-y-2">
              {entry.mitigations.map((m, i) => (
                <div
                  key={i}
                  className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
                >
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {m.phases.map((phase) => (
                      <Badge
                        key={phase}
                        className="border-zinc-700 bg-zinc-900 text-zinc-300 text-xs"
                      >
                        {phase}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {m.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CweSection({ entries }: { entries: CweEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Нет данных CWE для этой находки.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <CweEntryCard key={entry.cwe_id} entry={entry} />
      ))}
    </div>
  );
}
