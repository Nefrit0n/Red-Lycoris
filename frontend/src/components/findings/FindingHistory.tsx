import { useMemo } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

import { useFindingEvents } from "@/api/findings";
import type { FindingEvent } from "@/types";

function dateKey(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return "Сегодня";
  if (isYesterday(d)) return "Вчера";
  return format(d, "d MMMM", { locale: ru });
}

const STATUS_LABEL: Record<number, string> = {
  0: "Открыта",
  1: "Подтверждена",
  2: "Ложное срабатывание",
  3: "Устранена",
  4: "Риск принят",
};

const CLOSE_REASON_LABEL: Record<string, string> = {
  false_positive: "Ложное срабатывание",
  mitigated: "Устранена",
  acceptable_risk: "Риск принят",
};

function actorLabel(event: FindingEvent): string | null {
  return event.user_full_name || event.user_email || null;
}

function EventItem({ event }: { event: FindingEvent }) {
  const rel = formatDistanceToNow(new Date(event.created_at), { locale: ru, addSuffix: true });
  const actor = actorLabel(event);
  const actorSuffix = actor ? ` · ${actor}` : "";

  switch (event.event_type) {
    case "created":
      return <BaseEvent icon="🆕" text={`Находка создана${actorSuffix}`} rel={rel} />;
    case "status_changed": {
      const from = typeof event.payload.from === "number" ? event.payload.from : -1;
      const to = typeof event.payload.to === "number" ? event.payload.to : -1;
      const note = typeof event.payload.note === "string" ? event.payload.note.trim() : "";
      const fromLabel = STATUS_LABEL[from] ?? String(event.payload.from ?? "—");
      const toLabel = STATUS_LABEL[to] ?? String(event.payload.to ?? "—");
      return (
        <div className="rounded-md border border-zinc-800 p-2">
          <BaseEvent icon="🔄" text={`Статус изменён: ${fromLabel} → ${toLabel}${actorSuffix}`} rel={rel} />
          {note ? (
            <details className="mt-1 text-xs text-zinc-400">
              <summary className="cursor-pointer">Комментарий</summary>
              <div className="mt-1 whitespace-pre-wrap">{note}</div>
            </details>
          ) : null}
        </div>
      );
    }
    case "closed": {
      const note = typeof event.payload.note === "string" ? event.payload.note : "";
      const reasonCode = String(event.payload.reason_code ?? "—");
      const reasonLabel = CLOSE_REASON_LABEL[reasonCode] ?? reasonCode;
      return (
        <div className="rounded-md border border-zinc-800 p-2">
          <BaseEvent icon="✅" text={`Закрыта (${reasonLabel})${actorSuffix}`} rel={rel} />
          {note ? (
            <details className="mt-1 text-xs text-zinc-400">
              <summary className="cursor-pointer">Комментарий</summary>
              <div className="mt-1 whitespace-pre-wrap">{note}</div>
            </details>
          ) : null}
        </div>
      );
    }
    case "reopened":
      return <BaseEvent icon="♻️" text={`Переоткрыта${actorSuffix}`} rel={rel} />;
    case "assigned":
      return <BaseEvent icon="👤" text={`Назначена: ${String(event.payload.to_email ?? "—")}${actorSuffix}`} rel={rel} />;
    case "unassigned":
      return <BaseEvent icon="🚫" text={`Назначение снято${actorSuffix}`} rel={rel} />;
    case "comment_added":
      return <BaseEvent icon="💬" text={`Комментарий добавлен${actorSuffix}`} rel={rel} />;
    case "comment_edited":
      return <BaseEvent icon="✏️" text={`Комментарий изменён${actorSuffix}`} rel={rel} />;
    case "comment_deleted":
      return <BaseEvent icon="🗑️" text={`Комментарий удалён${actorSuffix}`} rel={rel} />;
    default:
      return <BaseEvent icon="•" text={event.event_type} rel={rel} />;
  }
}

function BaseEvent({ icon, text, rel }: { icon: string; text: string; rel: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-sm text-zinc-200">
        <span>{icon}</span>
        <span>{text}</span>
      </div>
      <span className="text-xs text-zinc-500">{rel}</span>
    </div>
  );
}

export default function FindingHistory({ findingId }: { findingId: string }) {
  const { data, isLoading } = useFindingEvents(findingId);

  const events = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const key = dateKey(event.created_at);
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }
    return Array.from(map.entries());
  }, [events]);

  if (isLoading) {
    return <div className="text-sm text-zinc-500">Загрузка истории...</div>;
  }

  return (
    <div className="space-y-4">
      {grouped.map(([key, list]) => (
        <section key={key} className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">{key}</h3>
          <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-900/50 p-2">
            {list.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
      {grouped.length === 0 ? <div className="text-sm text-zinc-500">Событий пока нет</div> : null}
    </div>
  );
}
