import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ActivityIcon, DownloadIcon, XIcon } from "lucide-react";

import {
  useAuditDiff,
  useAuditEvent,
  useAuditLog,
  useAuditStats,
  useRelatedAuditEvents,
  type AuditEntry,
  type AuditEntryGroup,
  type AuditFeedItem,
  type AuditFilter,
} from "@/api/audit";
import { useCurrentUser } from "@/api/auth";
import { apiGet } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface AdminUser {
  id: string;
  email: string;
}

interface Preset {
  id: string;
  label: string;
  filters: Record<string, string>;
}

const FILTER_OPTIONS = [
  { key: "user_id", label: "Пользователь" },
  { key: "action", label: "Действие" },
  { key: "resource_type", label: "Ресурс" },
  { key: "status_min", label: "Статус от" },
  { key: "method", label: "Метод" },
  { key: "from", label: "С" },
  { key: "to", label: "По" },
  { key: "trace_id", label: "Trace ID" },
  { key: "session_id", label: "Session ID" },
  { key: "q", label: "Поиск" },
] as const;

const BUILTIN_PRESETS: Preset[] = [
  { id: "errors-today", label: "Ошибки сегодня", filters: { status_min: "400", from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() } },
  { id: "critical-actions", label: "Критичные действия", filters: { risk_level: "critical" } },
  { id: "last-hour", label: "Последний час", filters: { from: new Date(Date.now() - 60 * 60 * 1000).toISOString() } },
  { id: "sensitive-events", label: "Sensitive events", filters: { action: "change_status" } },
];

function isGroup(item: AuditFeedItem): item is AuditEntryGroup {
  return (item as AuditEntryGroup).kind === "group";
}

function getItemEventId(item: AuditFeedItem): string {
  return isGroup(item) ? item.sample.id : item.id;
}

function methodClass(method: string): string {
  switch (method) {
    case "GET": return "bg-[var(--method-get-bg)] text-[var(--method-get-fg)]";
    case "POST": return "bg-[var(--method-post-bg)] text-[var(--method-post-fg)]";
    case "PATCH": return "bg-[var(--method-patch-bg)] text-[var(--method-patch-fg)]";
    case "PUT": return "bg-[var(--method-put-bg)] text-[var(--method-put-fg)]";
    case "DELETE": return "bg-[var(--method-delete-bg)] text-[var(--method-delete-fg)]";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusClass(status: number): string {
  if (status >= 500) return "bg-[var(--http-5xx-bg)] text-[var(--http-5xx-fg)]";
  if (status >= 400) return "bg-[var(--http-4xx-bg)] text-[var(--http-4xx-fg)]";
  if (status >= 300) return "bg-[var(--http-3xx-bg)] text-[var(--http-3xx-fg)]";
  return "bg-[var(--http-2xx-bg)] text-[var(--http-2xx-fg)]";
}

function riskStripe(level?: string): string {
  switch (level) {
    case "critical": return "bg-[var(--risk-critical)]";
    case "high": return "bg-[var(--risk-high)]";
    case "medium": return "bg-[var(--risk-medium)]";
    default: return "bg-[var(--risk-low)]";
  }
}

function middleEllipsis(value: string, max = 56): string {
  if (value.length <= max) return value;
  const left = Math.floor(max / 2) - 2;
  const right = Math.floor(max / 2) - 2;
  return `${value.slice(0, left)}…${value.slice(value.length - right)}`;
}

function maskedIP(ip?: string): string { return ip ?? "—"; }
function browserLabel(item: AuditEntry): string { return item.ua_parsed?.browser || "Unknown"; }
function stringifyJSON(value: unknown): string { return JSON.stringify(value, null, 2); }

function ActiveChips({ params, onRemove }: { params: URLSearchParams; onRemove: (k: string) => void }) {
  const chips = Array.from(params.entries()).filter(([k]) => k !== "cursor" && k !== "event");
  if (chips.length === 0) return <span className="text-xs text-muted-foreground">Фильтры не заданы</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(([key, value]) => (
        <button key={`${key}:${value}`} type="button" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs" onClick={() => onRemove(key)}>
          <span className="font-medium">{key}:</span><span>{value}</span><span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

function kpiDelta(current: number, prev: number): string {
  if (prev === 0 && current === 0) return "0%";
  if (prev === 0) return "+100%";
  const value = ((current - prev) / prev) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function AdminAudit() {
  const { data: currentUser } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const [customPresets, setCustomPresets] = useLocalStorage<Preset[]>("audit-custom-presets", []);
  const [newFilterKey, setNewFilterKey] = useState<string>(FILTER_OPTIONS[0].key);
  const [newFilterValue, setNewFilterValue] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [isRawOpen, setIsRawOpen] = useState<boolean>(false);
  const [liveEnabled, setLiveEnabled] = useState<boolean>(false);
  const [liveItems, setLiveItems] = useState<AuditFeedItem[]>([]);
  const [pendingItems, setPendingItems] = useState<AuditEntry[]>([]);

  const eventId = params.get("event") ?? undefined;

  const filter: AuditFilter = useMemo(() => ({
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    user_id: params.get("user_id") || undefined,
    resource_type: params.get("resource_type") || undefined,
    resource_id: params.get("resource_id") || undefined,
    action: params.get("action") || undefined,
    method: params.get("method") || undefined,
    status_min: params.get("status_min") || undefined,
    risk_level: params.get("risk_level") || undefined,
    trace_id: params.get("trace_id") || undefined,
    session_id: params.get("session_id") || undefined,
    q: params.get("q") || undefined,
    request_id: params.get("request_id") || undefined,
    grouped: "true",
    limit: "100",
  }), [params]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditLog(filter);
  const { data: selectedEvent } = useAuditEvent(eventId);
  const { data: diff, isLoading: isDiffLoading } = useAuditDiff(eventId);
  const { data: related, isLoading: isRelatedLoading } = useRelatedAuditEvents(eventId);
  const { data: stats } = useAuditStats(filter.from, filter.to);

  const usersQuery = useQuery({
    queryKey: ["admin-users-for-audit"],
    queryFn: async () => (await apiGet<{ data: AdminUser[] }>("/api/v1/admin/users", { limit: "500" })).data,
  });

  const queryRows = useMemo(() => data?.pages.flatMap((p: { data: AuditFeedItem[] }) => p.data) ?? [], [data]);
  const rows = useMemo(() => [...liveItems, ...queryRows], [liveItems, queryRows]);

  const drawerRef = useRef<HTMLElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 62, overscan: 12 });

  useEffect(() => {
    const node = parentRef.current;
    if (!node) return;
    const onScroll = () => {
      if (node.scrollTop < 24 && pendingItems.length > 0) {
        setLiveItems((prev) => [...pendingItems, ...prev]);
        setPendingItems([]);
      }
    };
    node.addEventListener("scroll", onScroll);
    return () => node.removeEventListener("scroll", onScroll);
  }, [pendingItems]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => setSelectedRow((prev) => Math.min(prev, Math.max(rows.length - 1, 0))), [rows.length]);

  useEffect(() => {
    if (!eventId) return;
    const index = rows.findIndex((item) => getItemEventId(item) === eventId);
    if (index >= 0) {
      setSelectedRow(index);
      rowVirtualizer.scrollToIndex(index, { align: "center" });
    }
  }, [eventId, rows, rowVirtualizer]);

  useEffect(() => {
    if (!liveEnabled) return;
    const url = new URL("/api/v1/admin/audit/stream", window.location.origin);
    Object.entries(filter).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    const source = new EventSource(url.toString(), { withCredentials: true });
    const listener = (evt: MessageEvent<string>) => {
      const parsed = JSON.parse(evt.data) as AuditEntry;
      const container = parentRef.current;
      const atTop = !!container && container.scrollTop < 24;
      if (atTop) {
        setLiveItems((prev) => [parsed, ...prev]);
      } else {
        setPendingItems((prev) => [parsed, ...prev]);
      }
    };
    source.addEventListener("audit", listener as EventListener);
    return () => source.close();
  }, [liveEnabled, filter]);

  useEffect(() => {
    const closeOnEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setParams((prev) => { const next = new URLSearchParams(prev); next.delete("event"); return next; });
    };
    window.addEventListener("keydown", closeOnEsc);
    return () => window.removeEventListener("keydown", closeOnEsc);
  }, [setParams]);

  useEffect(() => {
    if (!eventId) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (tableRef.current?.contains(target)) return;
      setParams((prev) => { const next = new URLSearchParams(prev); next.delete("event"); return next; });
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [eventId, setParams]);

  const updateParam = (key: string, value?: string) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (value && value.trim() !== "") p.set(key, value.trim()); else p.delete(key);
      p.delete("cursor");
      return p;
    });
  };

  const openEvent = (id: string, index?: number) => {
    if (typeof index === "number") setSelectedRow(index);
    setParams((prev) => { const p = new URLSearchParams(prev); p.set("event", id); return p; });
  };

  const closeEvent = () => setParams((prev) => { const p = new URLSearchParams(prev); p.delete("event"); return p; });

  const onTableHotkeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "j") {
      event.preventDefault();
      setSelectedRow((prev) => { const next = Math.min(prev + 1, Math.max(rows.length - 1, 0)); rowVirtualizer.scrollToIndex(next, { align: "auto" }); return next; });
      return;
    }
    if (event.key === "k") {
      event.preventDefault();
      setSelectedRow((prev) => { const next = Math.max(prev - 1, 0); rowVirtualizer.scrollToIndex(next, { align: "auto" }); return next; });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const row = rows[selectedRow];
      if (row) openEvent(getItemEventId(row), selectedRow);
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      document.getElementById("audit-search")?.focus();
    }
  };

  const applyPreset = (preset: Preset) => {
    setParams(() => { const next = new URLSearchParams(); Object.entries(preset.filters).forEach(([key, value]) => { if (value) next.set(key, value); }); return next; });
  };

  const saveCurrentPreset = () => {
    const label = window.prompt("Название пресета", "Мой пресет");
    if (!label) return;
    const entries = Array.from(params.entries()).filter(([k]) => k !== "cursor");
    setCustomPresets((prev) => [...prev, { id: `${Date.now()}`, label, filters: Object.fromEntries(entries) }]);
  };

  const exportAudit = (format: "csv" | "ndjson") => {
    const exportUrl = new URL("/api/v1/admin/audit/export", window.location.origin);
    exportUrl.searchParams.set("format", format);
    Object.entries(filter).forEach(([key, value]) => {
      if (value) exportUrl.searchParams.set(key, value);
    });
    window.open(exportUrl.toString(), "_blank", "noopener,noreferrer");
  };

  if (!currentUser) return null;
  if (currentUser.global_role !== 1) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">admin / audit</div>
        <h1 className="text-3xl font-semibold tracking-tight">Журнал аудита</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <div />
        <div className="flex items-center gap-2">
          <Button variant={liveEnabled ? "default" : "outline"} size="sm" onClick={() => setLiveEnabled((v) => !v)}>
            <ActivityIcon className="mr-1 size-3" />
            <span className="text-xs">Live tail</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <DownloadIcon className="mr-1 size-3" /> Экспорт
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportAudit("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAudit("ndjson")}>NDJSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button type="button" className="rounded-lg border bg-card p-3 text-left" onClick={() => { updateParam("from", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); updateParam("to", new Date().toISOString()); }}>
          <div className="text-xs text-muted-foreground">События за 24ч</div>
          <div className="text-2xl font-medium">{stats?.events_24h ?? 0}</div>
          <div className={`text-xs ${(stats?.events_24h ?? 0) >= (stats?.prev_events_24h ?? 0) ? "text-emerald-400" : "text-muted-foreground"}`}>
            {kpiDelta(stats?.events_24h ?? 0, stats?.prev_events_24h ?? 0)} vs вчера
          </div>
        </button>
        <button type="button" className="rounded-lg border bg-card p-3 text-left" onClick={() => updateParam("user_id", undefined)}>
          <div className="text-xs text-muted-foreground">Уникальные пользователи</div>
          <div className="text-2xl font-medium">{stats?.unique_users_24h ?? 0}</div>
          <div className="text-xs text-muted-foreground">из {Math.max(stats?.unique_users_24h ?? 0, stats?.prev_unique_users_24h ?? 0)} активных</div>
        </button>
        <button type="button" className="rounded-lg border bg-card p-3 text-left" onClick={() => updateParam("status_min", "400")}>
          <div className="text-xs text-muted-foreground">Ошибки 4xx/5xx</div>
          <div className="text-2xl font-medium text-amber-400">{stats?.errors_24h ?? 0}</div>
          <div className="text-xs text-amber-300">{kpiDelta(stats?.errors_24h ?? 0, stats?.prev_errors_24h ?? 0)}</div>
        </button>
        <button type="button" className="rounded-lg border bg-card p-3 text-left" onClick={() => updateParam("risk_level", "critical")}>
          <div className="text-xs text-muted-foreground">Критичные действия</div>
          <div className="text-2xl font-medium text-rose-400">{stats?.critical_24h ?? 0}</div>
          <div className="text-xs text-rose-300">{kpiDelta(stats?.critical_24h ?? 0, stats?.prev_critical_24h ?? 0)}</div>
        </button>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Активность за 24 часа</div>
          <div className="text-xs text-muted-foreground">UTC+3 · клик по столбцу = фильтр по часу</div>
        </div>
        <div className="grid h-28 grid-cols-24 items-end gap-1">
          {(stats?.histogram ?? []).slice(-24).map((bucket) => {
            const max = Math.max(...(stats?.histogram ?? [{ total: 1 }]).map((h) => h.total), 1);
            const height = `${Math.max(6, (bucket.total / max) * 100)}%`;
            const bg = bucket.error_ratio > 0.35 ? "bg-red-500/70" : bucket.error_ratio > 0.15 ? "bg-amber-500/70" : "bg-muted-foreground/60";
            const hour = new Date(bucket.hour);
            return (
              <button
                key={bucket.hour}
                type="button"
                title={`${hour.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}: ${bucket.total} событий (4xx/5xx: ${bucket.error_count})`}
                className="relative flex h-full items-end"
                onClick={() => {
                  const from = new Date(hour);
                  const to = new Date(hour.getTime() + 60 * 60 * 1000 - 1);
                  updateParam("from", from.toISOString());
                  updateParam("to", to.toISOString());
                }}
              >
                <span className={`w-full rounded-sm ${bg}`} style={{ height }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Фильтры:</span>
            <ActiveChips params={params} onRemove={(k) => updateParam(k, undefined)} />
          </div>
          <div className="flex items-center gap-3 text-xs">
            {BUILTIN_PRESETS.map((preset) => <button key={preset.id} type="button" className="text-muted-foreground hover:text-foreground" onClick={() => applyPreset(preset)}>{preset.label}</button>)}
            {customPresets.map((preset) => <button key={preset.id} type="button" className="text-muted-foreground hover:text-foreground" onClick={() => applyPreset(preset)}>{preset.label}</button>)}
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={saveCurrentPreset}>Сохранить пресет</button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
          <select className="rounded-md border bg-background px-2 text-sm" value={newFilterKey} onChange={(e) => setNewFilterKey(e.target.value)}>
            {FILTER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <Input id="audit-search" placeholder="Значение фильтра" value={newFilterValue} onChange={(e) => setNewFilterValue(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { updateParam(newFilterKey, newFilterValue); setNewFilterValue(""); }}>+ добавить</Button>
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>Очистить</Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Быстрый выбор пользователя:</span>
          <select className="rounded-md border bg-background px-2 py-1 text-xs" value={params.get("user_id") ?? ""} onChange={(e) => updateParam("user_id", e.target.value || undefined)}>
            <option value="">Все пользователи</option>
            {(usersQuery.data ?? []).map((u: AdminUser) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
        </div>
      </div>

      {pendingItems.length > 0 ? (
        <button
          type="button"
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
          onClick={() => {
            setLiveItems((prev) => [...pendingItems, ...prev]);
            setPendingItems([]);
            parentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ↑ {pendingItems.length} новых событий
        </button>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]" ref={tableRef}>
        <div ref={parentRef} tabIndex={0} onKeyDown={onTableHotkeys} role="grid" className="themed-scrollbar h-[68vh] overflow-auto rounded-lg border bg-card/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <div className="sticky top-0 z-10 grid grid-cols-[4px_92px_1fr_76px_1.4fr_74px] border-b bg-background/95 py-2 text-xs text-muted-foreground backdrop-blur">
            <span /><span className="px-3">Время</span><span className="px-3">Пользователь</span><span className="px-2">Метод</span><span className="px-3">Путь</span><span className="px-2">Статус</span>
          </div>

          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow: { index: number; start: number }) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const event = isGroup(row) ? row.sample : row;
              const rowEventId = getItemEventId(row);
              const isSelected = eventId === rowEventId || selectedRow === virtualRow.index;
              const time = new Date(event.created_at);
              const relativeTime = formatDistanceToNowStrict(time, { addSuffix: true, locale: ru });
              const absoluteTime = time.toLocaleTimeString("ru-RU");
              const userMeta = `${event.ua_parsed?.country_code ? `${event.ua_parsed.country_code} ` : ""}${maskedIP(event.ip)} · ${browserLabel(event)}`;
              return (
                <button
                  key={isGroup(row) ? `group-${row.sample.id}-${row.count}` : event.id}
                  type="button"
                  role="row"
                  title={time.toLocaleString("ru-RU", { timeZoneName: "short" })}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  className={`absolute left-0 top-0 grid h-[62px] w-full grid-cols-[4px_92px_1fr_76px_1.4fr_74px] border-b text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${isSelected ? "bg-accent/40" : "hover:bg-accent/20"}`}
                  onClick={() => openEvent(rowEventId, virtualRow.index)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(rowEventId, virtualRow.index); } }}
                >
                  <span className={riskStripe(event.risk_level)} aria-hidden />
                  <span className="px-3 py-2"><span className="block text-xs font-medium">{relativeTime}</span><span className="block text-[10px] text-muted-foreground">{absoluteTime}</span></span>
                  <span className="px-3 py-2"><span className="block truncate">{event.user_email ?? "—"}</span><span className="block text-[10px] text-muted-foreground">{userMeta}</span></span>
                  <span className="px-2 py-2"><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${methodClass(event.method)}`}>{event.method}</span></span>
                  <span className="px-3 py-2 font-mono text-xs" title={event.full_path || event.path}>{isGroup(row) ? `▸ ${row.count}× ${event.resource_type ?? "resource"}/${event.action ?? "action"} · ${new Date(row.first_timestamp).toLocaleTimeString("ru-RU")} → ${new Date(row.last_timestamp).toLocaleTimeString("ru-RU")}` : middleEllipsis(event.path)}</span>
                  <span className="px-2 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(event.status_code)}`}>{event.status_code}</span></span>
                </button>
              );
            })}
          </div>
          <div ref={sentinelRef} className="h-8" />
        </div>

        <aside ref={drawerRef} className="h-[68vh] overflow-auto rounded-lg border bg-card p-4 lg:sticky lg:top-2" aria-label="Детали события аудита">
          {!eventId || !selectedEvent ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Выберите событие в таблице, чтобы открыть детали.</div> : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-medium">{selectedEvent.resource_type ?? "resource"} / {selectedEvent.action ?? "action"}</h3>
                  <div className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${riskStripe(selectedEvent.risk_level)}`} /><span>Риск: {selectedEvent.risk_level ?? "low"}</span></div>
                </div>
                <Button size="icon-sm" variant="ghost" onClick={closeEvent} aria-label="Закрыть drawer"><XIcon /></Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><div className="text-muted-foreground">Request ID</div><div className="font-mono break-all">{selectedEvent.request_id ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Trace ID</div><div className="font-mono break-all">{selectedEvent.trace_id ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Session ID</div><div className="font-mono break-all">{selectedEvent.session_id ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Duration</div><div>{selectedEvent.duration_ms} ms</div></div>
                <div><div className="text-muted-foreground">IP / UA</div><div>{maskedIP(selectedEvent.ip)} · {selectedEvent.ua_parsed?.browser ?? "Unknown"} / {selectedEvent.ua_parsed?.os ?? "Unknown"}</div></div>
                <div><div className="text-muted-foreground">Целостность</div><div>{selectedEvent.integrity?.verified ? "✓ verified" : "—"}</div></div>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-medium">Diff</h4>
                {isDiffLoading ? <div className="text-xs text-muted-foreground">Загрузка…</div> : null}
                {!isDiffLoading && (diff?.length ?? 0) === 0 ? <div className="text-xs text-muted-foreground">Изменений нет.</div> : null}
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border bg-muted/20 p-2 font-mono text-xs">
                  {(diff ?? []).map((change, index: number) => (
                    <div key={`${change.field}-${index}`}><div className="text-muted-foreground">{change.field}</div><div className="text-red-600">- {stringifyJSON(change.before)}</div><div className="text-green-600">+ {stringifyJSON(change.after)}</div></div>
                  ))}
                </div>
              </section>

              <section className="space-y-2"><h4 className="text-sm font-medium">Сигналы риска</h4>{(selectedEvent.risk_signals ?? []).length === 0 ? <div className="text-xs text-muted-foreground">Нет сигналов риска.</div> : <ul className="list-disc space-y-1 pl-5 text-xs">{(selectedEvent.risk_signals ?? []).map((signal) => <li key={signal}>{signal}</li>)}</ul>}</section>

              <section className="space-y-2">
                <h4 className="text-sm font-medium">Связанные события</h4>
                {isRelatedLoading ? <div className="text-xs text-muted-foreground">Загрузка…</div> : null}
                {!isRelatedLoading && (related?.length ?? 0) === 0 ? <div className="text-xs text-muted-foreground">Нет связанных событий.</div> : null}
                <div className="space-y-1">{(related ?? []).map((item) => <button key={item.id} type="button" className="w-full rounded-md border p-2 text-left text-xs hover:bg-accent/20" onClick={() => openEvent(item.id)}><div className="font-mono">{item.trace_id || item.session_id || item.request_id || item.id}</div><div className="text-muted-foreground">{item.method} {item.path} · {new Date(item.created_at).toLocaleTimeString("ru-RU")}</div></button>)}</div>
              </section>

              <div className="flex flex-wrap gap-2 pt-2"><Button variant="outline" size="sm" onClick={() => setIsRawOpen(true)}>Raw JSON</Button></div>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={isRawOpen} onOpenChange={setIsRawOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Raw JSON события</DialogTitle></DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{stringifyJSON(selectedEvent)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
