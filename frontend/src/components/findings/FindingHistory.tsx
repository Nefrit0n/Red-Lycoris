import { useMemo } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

import { useFindingEvents } from "@/api/findings";

function dateKey(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return "Сегодня";
  if (isYesterday(d)) return "Вчера";
  return format(d, "d MMMM", { locale: ru });
}

function EventItem({ event }: { event: { event_type: string; created_at: string; payload: Record<string, unknown> } }) {
  const rel = formatDistanceToNow(new Date(event.created_at), { locale: ru, addSuffix: true });

  switch (event.event_type) {
    case "created":
      return <BaseEvent icon="🆕" text="Находка создана" rel={rel} />;
    case "seen_again":
      return <BaseEvent icon="👁️" text="Находка снова обнаружена" rel={rel} />;
    case "status_changed":
      return <BaseEvent icon="🔄" text={`Статус изменён: ${String(event.payload.from)} → ${String(event.payload.to)}`} rel={rel} />;
    case "closed": {
      const note = typeof event.payload.note === "string" ? event.payload.note : "";
      return (
        <div className="rounded-md border border-zinc-800 p-2">
          <BaseEvent icon="✅" text={`Закрыта (${String(event.payload.reason_code ?? "—")})`} rel={rel} />
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
      return <BaseEvent icon="♻️" text="Переоткрыта" rel={rel} />;
    case "assigned":
      return <BaseEvent icon="👤" text={`Назначена: ${String(event.payload.to_email ?? "—")}`} rel={rel} />;
    case "unassigned":
      return <BaseEvent icon="🚫" text="Назначение снято" rel={rel} />;
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
