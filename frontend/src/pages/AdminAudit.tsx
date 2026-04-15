import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useCurrentUser } from "@/api/auth";
import { useAuditLog, type AuditEntry, type AuditFilter } from "@/api/audit";
import { apiGet } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RESOURCE_TYPES = ["finding", "project", "user", "comment", "enrichment", "import", "member"];
const ACTIONS = ["create", "update", "delete", "close", "reopen", "assign", "unassign", "change_status", "manage_members", "comment"];

interface AdminUser {
  id: string;
  email: string;
}

function statusVariant(status: number): "default" | "secondary" | "outline" {
  if (status >= 200 && status < 300) return "default";
  if (status >= 400) return "secondary";
  return "outline";
}

export default function AdminAudit() {
  const { data: currentUser } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filter: AuditFilter = useMemo(() => ({
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    user_id: params.get("user_id") || undefined,
    resource_type: params.get("resource_type") || undefined,
    resource_id: params.get("resource_id") || undefined,
    action: params.get("action") || undefined,
    q: params.get("q") || undefined,
    request_id: params.get("request_id") || undefined,
    limit: "50",
  }), [params]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditLog(filter);

  const usersQuery = useQuery({
    queryKey: ["admin-users-for-audit"],
    queryFn: async () => {
      const res = await apiGet<{ data: AdminUser[] }>("/api/v1/admin/users", { limit: "500" });
      return res.data;
    },
  });

  const rows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (!currentUser) return null;
  if (currentUser.global_role !== 1) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-900 p-3 md:grid-cols-3 lg:grid-cols-6">
        <Input
          type="datetime-local"
          value={params.get("from") ?? ""}
          onChange={(e) => setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (e.target.value) p.set("from", new Date(e.target.value).toISOString()); else p.delete("from");
            p.delete("cursor");
            return p;
          })}
        />
        <Input
          type="datetime-local"
          value={params.get("to") ?? ""}
          onChange={(e) => setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (e.target.value) p.set("to", new Date(e.target.value).toISOString()); else p.delete("to");
            p.delete("cursor");
            return p;
          })}
        />
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm"
          value={params.get("user_id") ?? ""}
          onChange={(e) => setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (e.target.value) p.set("user_id", e.target.value); else p.delete("user_id");
            return p;
          })}
        >
          <option value="">Все пользователи</option>
          {(usersQuery.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm"
          value={params.get("resource_type") ?? ""}
          onChange={(e) => setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (e.target.value) p.set("resource_type", e.target.value); else p.delete("resource_type");
            return p;
          })}
        >
          <option value="">Все ресурсы</option>
          {RESOURCE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm"
          value={params.get("action") ?? ""}
          onChange={(e) => setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (e.target.value) p.set("action", e.target.value); else p.delete("action");
            return p;
          })}
        >
          <option value="">Все действия</option>
          {ACTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="flex gap-2">
          <Input
            placeholder="Поиск по пути"
            value={params.get("q") ?? ""}
            onChange={(e) => setParams((prev) => {
              const p = new URLSearchParams(prev);
              if (e.target.value) p.set("q", e.target.value); else p.delete("q");
              return p;
            })}
          />
          <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>Очистить</Button>
        </div>
      </div>

      <div ref={parentRef} className="h-[60vh] overflow-auto rounded-md border border-zinc-800 bg-zinc-900/50">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row: AuditEntry = rows[virtualRow.index];
            if (!row) return null;
            const isExpanded = expandedId === row.id;
            return (
              <div
                key={row.id}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                className="absolute left-0 top-0 w-full border-b border-zinc-800"
              >
                <button
                  className="grid w-full grid-cols-6 gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-800/40"
                  onClick={() => setExpandedId((prev) => prev === row.id ? null : row.id)}
                >
                  <span>{new Date(row.created_at).toLocaleString("ru-RU")}</span>
                  <span>{row.user_email ?? "—"}</span>
                  <span><Badge>{row.method}</Badge></span>
                  <span className="truncate font-mono text-xs">{row.path}</span>
                  <span><Badge variant={statusVariant(row.status_code)}>{row.status_code}</Badge></span>
                  <span>{row.resource_type ?? "—"} / {row.action ?? "—"}</span>
                </button>
                {isExpanded && (
                  <div className="grid gap-1 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                    <div>Request ID: <span className="font-mono">{row.request_id ?? "—"}</span></div>
                    <div>IP: {row.ip ?? "—"}</div>
                    <div>User Agent: {row.user_agent ?? "—"}</div>
                    <div>Duration: {row.duration_ms} ms</div>
                    <div>Full Path: <span className="font-mono">{row.path}</span></div>
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setParams((prev) => {
                          const p = new URLSearchParams(prev);
                          if (row.request_id) p.set("request_id", row.request_id);
                          return p;
                        })}
                      >
                        Найти связанные
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div ref={sentinelRef} className="h-8" />
      </div>
    </div>
  );
}
