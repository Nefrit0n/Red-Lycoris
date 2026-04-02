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
  items: Finding[];
  total: number;
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
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (severity !== "all") params.set("severity", severity);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (search.trim()) params.set("search", search.trim());

    request<FindingsResponse>(`/api/v1/findings?${params.toString()}`)
      .then((res) => setItems(res.items ?? []))
      .catch(() => setItems([]));
  }, [severity, status, type, search]);

  useEffect(() => {
    request<StatsResponse>("/api/v1/findings/stats")
      .then(setStats)
      .catch(() =>
        setStats({
          total: items.length,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          byStatus: {},
          byType: {},
        })
      );
  }, [items.length]);

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
      method: "PATCH",
      json: true,
      body: { ids: [...selected], status: nextStatus },
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
