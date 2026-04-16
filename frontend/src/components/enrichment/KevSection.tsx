import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertOctagon,
  Calendar,
  ClipboardList,
  ExternalLink,
  Flame,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASSES, URGENCY_TO_SEVERITY } from "./cvss-metrics";

export interface KevEntry {
  cve_id: string;
  vendor?: string;
  product?: string;
  vulnerability_name?: string;
  short_description?: string;
  required_action?: string;
  notes?: string;
  date_added?: string;
  due_date?: string;
  days_until_due?: number;
  known_ransomware: boolean;
  urgency_tier: "overdue" | "imminent" | "high" | "normal" | "low" | "no_deadline";
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function formatCountdown(daysUntilDue: number, tier: KevEntry["urgency_tier"]): string {
  if (tier === "overdue") {
    const days = Math.abs(daysUntilDue);
    return `Просрочено на ${days} ${pluralDays(days)}`;
  }
  if (tier === "no_deadline") {
    return "Без дедлайна";
  }
  return `До дедлайна ${daysUntilDue} ${pluralDays(daysUntilDue)}`;
}

function urgencyLabel(tier: KevEntry["urgency_tier"]): string {
  switch (tier) {
    case "overdue":
      return "Просрочено";
    case "imminent":
      return "Imminent";
    case "high":
      return "High";
    case "normal":
      return "Normal";
    case "low":
      return "Low";
    default:
      return "Без дедлайна";
  }
}

function formatDate(value: string): string {
  return format(parseISO(value), "d MMMM yyyy", { locale: ru });
}

function KevEntryCard({ entry }: { entry: KevEntry }) {
  const tierClass = SEVERITY_CLASSES[URGENCY_TO_SEVERITY[entry.urgency_tier]];
  const days = entry.days_until_due ?? 0;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center gap-3 rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3">
          <Flame className="size-5 shrink-0 text-red-400" />
          <CardTitle className="text-sm font-semibold text-red-300">
            Эксплуатируется в дикой природе
          </CardTitle>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <a
            href={`https://nvd.nist.gov/vuln/detail/${entry.cve_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-red-300 hover:underline"
          >
            {entry.cve_id}
            <ExternalLink className="size-3.5" />
          </a>

          <Tooltip content="Срочность определяется по due_date из CISA KEV каталога.">
            <Badge className={cn("gap-2 border", tierClass)}>
              <span>{urgencyLabel(entry.urgency_tier)}</span>
              <span>·</span>
              <span>{formatCountdown(days, entry.urgency_tier)}</span>
            </Badge>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {entry.vulnerability_name && (
          <p className="text-sm text-zinc-200">{entry.vulnerability_name}</p>
        )}

        {entry.known_ransomware && (
          <div className="flex items-start gap-2 rounded-md border border-red-700/60 bg-red-950/50 px-3 py-2">
            <AlertOctagon className="mt-0.5 size-5 shrink-0 text-red-400" />
            <div>
              <div className="font-medium text-red-300">
                Активно используется в атаках шифровальщиков
              </div>
              <div className="mt-0.5 text-xs text-red-400/80">
                CISA подтверждает использование этой уязвимости в кампаниях ransomware.
              </div>
            </div>
          </div>
        )}

        {entry.required_action && (
          <div className="rounded-md border border-blue-800/50 bg-blue-950/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList className="size-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Требуемое действие от CISA</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{entry.required_action}</p>
          </div>
        )}

        {entry.short_description && (
          <div>
            <div className="mb-1 text-xs text-zinc-500">Краткое описание</div>
            <p className="text-sm leading-relaxed text-zinc-300">{entry.short_description}</p>
          </div>
        )}

        <div className="space-y-1 text-xs text-zinc-500">
          {entry.date_added && (
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5" />
              <span>Добавлено в KEV: {formatDate(entry.date_added)}</span>
            </div>
          )}
          {entry.due_date && (
            <div>
              Дедлайн CISA: {formatDate(entry.due_date)} ({formatCountdown(days, entry.urgency_tier)})
            </div>
          )}
          {entry.vendor && <div>Поставщик: <span className="font-mono">{entry.vendor}</span></div>}
          {entry.product && <div>Продукт: <span className="font-mono">{entry.product}</span></div>}
        </div>

        {entry.notes && (
          <p className="border-t border-zinc-800 pt-2 text-xs text-zinc-500">{entry.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function KevSection({ entries }: { entries: KevEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <KevEntryCard key={`${entry.cve_id}-${entry.due_date ?? "no-deadline"}`} entry={entry} />
      ))}
    </div>
  );
}
