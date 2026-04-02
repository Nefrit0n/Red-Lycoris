import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api/client";
import {
  FindingType,
  Pill,
  SevBadge,
  Severity,
  StackedSeverityBar,
  StatusPill,
  TypeBadge,
  severityMeta,
  statusMeta,
  typeMeta,
} from "../components/findingsV2";
import styles from "./FindingsPage.module.css";

type FindingStatus = "new" | "open" | "in_progress" | "fixed" | "false_positive" | "accepted_risk";

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  type: FindingType;
  product: string;
  productId: number;
  tool: string;
  firstSeen: string;
  lastSeen: string;
}

interface FindingsResponse {
  items?: unknown[];
  data?: unknown[];
  total?: number;
  meta?: {
    total?: number;
    severityCounts?: Partial<Record<Severity, number>>;
    statusCounts?: Record<string, number>;
    categoryCounts?: Array<{ category: string; count: number }>;
  };
}

interface StatsResponse {
  total: number;
  bySeverity: Record<Severity, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

const sevFilters: Array<{ key: Severity | "all"; label: string }> = [
  { key: "all", label: "Все" },
  { key: "critical", label: "КРИТ" },
  { key: "high", label: "ВЫС" },
  { key: "medium", label: "СР" },
  { key: "low", label: "НИЗ" },
  { key: "info", label: "ИНФ" },
];

const typeFilters: Array<{ key: FindingType | "all"; label: string }> = [
  { key: "all", label: "Все" },
  { key: "SAST", label: "SAST" },
  { key: "DAST", label: "DAST" },
  { key: "SCA", label: "SCA" },
  { key: "SECRETS", label: "SECRETS" },
  { key: "IAC", label: "IAC" },
];

const statusFilters: Array<{ key: FindingStatus | "all"; label: string }> = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новая" },
  { key: "open", label: "Открыта" },
  { key: "in_progress", label: "В работе" },
  { key: "fixed", label: "Исправлена" },
  { key: "false_positive", label: "Лож. сраб." },
];

const FindingsPage = () => {
  const [items, setItems] = useState<Finding[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [type, setType] = useState<FindingType | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: "severity" | "title" | "status" | "type" | "date"; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  useEffect(() => {
    const params = new URLSearchParams({ offset: "0", limit: "50", includeMeta: "true" });
    if (severity !== "all") params.set("severity", severity);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (search.trim()) params.set("search", search.trim());

    request<FindingsResponse>(`/api/v1/findings?${params.toString()}`)
      .then((res) => {
        const rawItems = Array.isArray(res.items) ? res.items : Array.isArray(res.data) ? res.data : [];
        const mapped = rawItems.map(mapFinding);
        setItems(mapped);

        const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        mapped.forEach((item) => {
          bySeverity[item.severity] += 1;
        });

        const byType: Record<string, number> = {};
        mapped.forEach((item) => {
          byType[item.type] = (byType[item.type] ?? 0) + 1;
        });

        const metaType = res.meta?.categoryCounts?.reduce<Record<string, number>>((acc, curr) => {
          acc[curr.category] = curr.count;
          return acc;
        }, {});

        setStats({
          total: res.meta?.total ?? mapped.length,
          bySeverity: {
            critical: res.meta?.severityCounts?.critical ?? bySeverity.critical,
            high: res.meta?.severityCounts?.high ?? bySeverity.high,
            medium: res.meta?.severityCounts?.medium ?? bySeverity.medium,
            low: res.meta?.severityCounts?.low ?? bySeverity.low,
            info: res.meta?.severityCounts?.info ?? bySeverity.info,
          },
          byStatus: res.meta?.statusCounts ?? {},
          byType: metaType ?? byType,
        });
      })
      .catch(() => setItems([]));
  }, [severity, status, type, search]);

  const sorted = useMemo(() => {
    const copy = [...items];
    const sevOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    copy.sort((a, b) => {
      const m = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "severity") return (sevOrder[a.severity] - sevOrder[b.severity]) * m;
      if (sort.key === "title") return a.title.localeCompare(b.title) * m;
      if (sort.key === "status") return a.status.localeCompare(b.status) * m;
      if (sort.key === "type") return a.type.localeCompare(b.type) * m;
      return (new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime()) * m;
    });
    return copy;
  }, [items, sort]);

  const selectionCount = selected.size;
  const allSelected = sorted.length > 0 && sorted.every((x) => selected.has(x.id));

  const toggleSort = (key: "severity" | "title" | "status" | "type" | "date") => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const bulkUpdate = async (nextStatus: FindingStatus) => {
    await request("/api/v1/findings/bulk", {
      method: "POST",
      json: true,
      body: {
        ids: [...selected],
        action: "set_status",
        payload: { status: nextStatus },
      },
    });
    setSelected(new Set());
  };

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.totalBox}>
          <strong>{stats?.total ?? items.length}</strong>
          <span>находок</span>
        </div>
        <StackedSeverityBar counts={stats?.bySeverity ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }} />
        <div className={styles.legend}>
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
            <span key={s} style={{ color: severityMeta[s].color, background: `${severityMeta[s].color}22` }}>
              {stats?.bySeverity?.[s] ?? 0} {severityMeta[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.group}>
          {sevFilters.map((f) => <Pill key={f.key} active={severity === f.key} count={f.key === "all" ? stats?.total : stats?.bySeverity?.[f.key as Severity]} color={f.key === "all" ? "#64748b" : severityMeta[f.key as Severity].color} onClick={() => setSeverity((v) => (v === f.key ? "all" : (f.key as Severity | "all")))}>{f.label}</Pill>)}
        </div>
        <div className={styles.sep} />
        <div className={styles.group}>
          {typeFilters.map((f) => <Pill key={f.key} active={type === f.key} count={f.key === "all" ? stats?.total : stats?.byType?.[f.key]} color={f.key === "all" ? "#64748b" : typeMeta[f.key as FindingType]?.color} onClick={() => setType((v) => (v === f.key ? "all" : (f.key as FindingType | "all")))}>{f.key !== "all" ? `${typeMeta[f.key as FindingType].icon} ${f.label}` : f.label}</Pill>)}
        </div>
        <div className={styles.sep} />
        <div className={styles.group}>
          {statusFilters.map((f) => <Pill key={f.key} active={status === f.key} count={f.key === "all" ? stats?.total : stats?.byStatus?.[f.key]} color={f.key === "all" ? "#64748b" : statusMeta[f.key]?.color} onClick={() => setStatus((v) => (v === f.key ? "all" : (f.key as FindingStatus | "all")))}>{f.label}</Pill>)}
        </div>
        <label className={styles.search}>
          🔎
          <input value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Поиск по title, id, tool" />
        </label>
      </div>

      <div className={styles.actions}>
        {selectionCount > 0 ? (
          <div className={styles.bulk}>
            <span>Выбрано: {selectionCount}</span>
            <button onClick={() => bulkUpdate("in_progress")}>Изм. статус</button>
            <button onClick={() => setSelected(new Set())}>Удалить</button>
          </div>
        ) : <span />}
        <button className={styles.exportBtn}>Экспорт</button>
      </div>

      <div className={styles.table}>
        <div className={`${styles.row} ${styles.head}`}>
          <div><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(sorted.map((x) => x.id)))} /></div>
          <div />
          <button onClick={() => toggleSort("title")}>Title</button>
          <button onClick={() => toggleSort("severity")}>Severity</button>
          <button onClick={() => toggleSort("status")}>Status</button>
          <button onClick={() => toggleSort("type")}>Type</button>
          <div>Product</div>
          <button onClick={() => toggleSort("date")}>Date</button>
        </div>

        {sorted.map((f) => (
          <Link to={`/findings/${f.id}`} key={f.id} className={styles.row}>
            <div onClick={(e) => { e.preventDefault(); const copy = new Set(selected); copy.has(f.id) ? copy.delete(f.id) : copy.add(f.id); setSelected(copy); }}>
              <span className={selected.has(f.id) ? styles.checked : styles.checkbox} />
            </div>
            <div className={styles.sevBar} style={{ background: severityMeta[f.severity].color, boxShadow: `0 0 6px ${severityMeta[f.severity].color}` }} />
            <div className={styles.titleCol}>
              <strong>{f.title}</strong>
              <span>{f.id} • {f.tool}</span>
            </div>
            <div><SevBadge severity={f.severity} /></div>
            <div><StatusPill status={f.status} /></div>
            <div><TypeBadge type={f.type} /></div>
            <div className={styles.product}>{f.product}</div>
            <div className={styles.date}>{f.firstSeen}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FindingsPage;

function mapFinding(raw: unknown): Finding {
  const row = raw as Record<string, unknown>;
  const severity = normalizeSeverity(row.severity);
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Без названия"),
    severity,
    status: normalizeStatus(row.status),
    type: normalizeType(row.type ?? row.category),
    product: String(row.product ?? row.productName ?? "—"),
    productId: Number(row.productId ?? 0),
    tool: String(row.tool ?? row.scannerType ?? row.sourceType ?? "unknown"),
    firstSeen: String(row.firstSeen ?? row.firstSeenAt ?? row.createdAt ?? "—"),
    lastSeen: String(row.lastSeen ?? row.lastSeenAt ?? row.updatedAt ?? "—"),
  };
}

function normalizeSeverity(value: unknown): Severity {
  const v = String(value ?? "info").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
  return "info";
}

function normalizeStatus(value: unknown): FindingStatus {
  const v = String(value ?? "new").toLowerCase();
  if (v === "new" || v === "open" || v === "in_progress" || v === "fixed" || v === "false_positive" || v === "accepted_risk") return v;
  if (v === "under_review") return "open";
  if (v === "confirmed") return "in_progress";
  if (v === "mitigated") return "fixed";
  if (v === "risk_accepted") return "accepted_risk";
  return "new";
}

function normalizeType(value: unknown): FindingType {
  const v = String(value ?? "SAST").toUpperCase();
  if (v === "SAST" || v === "DAST" || v === "SCA" || v === "SECRETS" || v === "IAC") return v;
  if (v === "CONFIG" || v === "CONTAINER") return "IAC";
  return "SAST";
}
