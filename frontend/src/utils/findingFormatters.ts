/**
 * Utility functions for formatting finding-related data
 */

import { FindingEvent, FindingStatus } from "../types/findings";
import { STATUS_LABELS } from "./findingConstants";

export type EventCategory = "all" | "status" | "comment" | "dedup" | "other";

/**
 * Get event category based on event type
 */
export function getEventCategory(event: FindingEvent): EventCategory {
  if (event.eventType.startsWith("status")) return "status";
  if (event.eventType.startsWith("comment")) return "comment";
  if (event.eventType.startsWith("duplicate")) return "dedup";
  return "other";
}

/**
 * Format event summary for display
 */
export function formatEventSummary(event: FindingEvent): string {
  switch (event.eventType) {
    case "status_changed": {
      const fromValue = typeof event.payload.from === "string" ? event.payload.from : "";
      const toValue = typeof event.payload.to === "string" ? event.payload.to : "";
      const fromLabel = (STATUS_LABELS[fromValue as FindingStatus] ?? fromValue) || "—";
      const toLabel = (STATUS_LABELS[toValue as FindingStatus] ?? toValue) || "—";
      return `Статус: ${fromLabel} → ${toLabel}`;
    }
    case "comment_added":
      return "Комментарий добавлен";
    case "assignee_changed": {
      const fromValue = typeof event.payload.from === "string" ? event.payload.from : "";
      const toValue = typeof event.payload.to === "string" ? event.payload.to : "";
      return `Assignee: ${fromValue || "—"} → ${toValue || "—"}`;
    }
    case "duplicate_promoted":
      return "Дубликат: назначен master";
    case "duplicate_unlinked":
      return "Дубликат: отвязан от master";
    case "deleted":
      return "Находка удалена";
    default:
      return event.eventType;
  }
}

/**
 * Format date in Russian locale
 */
export function formatDateRu(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ru-RU");
}

/**
 * Build finding link with optional returnTo parameter
 */
export function buildFindingLink(findingId: string, returnToParam?: string): string {
  const query = returnToParam ? `?returnTo=${returnToParam}` : "";
  return `/findings/${findingId}${query}`;
}
