import { ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { bulkUpdateFindings } from "../api/findings";
import { useFiltersState } from "../hooks/useFiltersState";
import { useFindingsData } from "../hooks/useFindingsData";
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
import type { FindingListItemDTO, FindingStatus } from "../types/findings";
import styles from "./FindingsPage.module.css";

type UiSortKey = "severity" | "title" | "status" | "type" | "date";

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
  { key: "under_review", label: "На ревью" },
  { key: "confirmed", label: "Подтверждена" },
  { key: "mitigated", label: "Исправлена" },
  { key: "false_positive", label: "Лож. сраб." },
  { key: "risk_accepted", label: "Принятый риск" },
];

const uiSortFromApi = (field: FindingListItemDTO[keyof FindingListItemDTO] | keyof FindingListItemDTO): UiSortKey => {
  if (field === "severity") return "severity";
  if (field === "title") return "title";
  if (field === "status") return "status";
  if (field === "category") return "type";
  return "date";
};

const apiSortFromUi = (field: UiSortKey): keyof FindingListItemDTO => {
  if (field === "severity") return "severity";
  if (field === "title") return "title";
  if (field === "status") return "status";
  if (field === "type") return "category";
  return "lastSeenAt";
};

const normalizeDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const severityCountsFallback = (rows: FindingListItemDTO[]) => {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  rows.forEach((row) => {
    const sev = (row.severity as Severity) ?? "info";
    counts[sev] += 1;
  });
  return counts;
};

const categoryCountsFallback = (rows: FindingListItemDTO[]) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.category;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

const FindingsPage = () => {
  const { state: filters, setPartial } = useFiltersState();
  const { data, total, totalKnown, hasNextPage, severityCounts, statusCounts, loading, error, handleRetry } =
    useFindingsData({ filters });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const uiSort: { key: UiSortKey; dir: "asc" | "desc" } = {
    key: uiSortFromApi(filters.sortField),
    dir: filters.sortOrder === "asc" ? "asc" : "desc",
  };

  const rows = useMemo(() => data.map(mapFinding), [data]);
  const selectionCount = selected.size;
  const allSelected = rows.length > 0 && rows.every((x) => selected.has(x.id));

  const effectiveSeverityCounts = useMemo(
    () => ({ ...severityCountsFallback(data), ...(severityCounts as Record<string, number> | undefined) }),
    [data, severityCounts],
  );
  const effectiveTypeCounts = useMemo(() => categoryCountsFallback(data), [data]);
  const effectiveTotal = totalKnown ? total ?? 0 : data.length;

  const toggleSort = (key: UiSortKey) => {
    if (uiSort.key === key) {
      setPartial({ sortOrder: uiSort.dir === "asc" ? "desc" : "asc", page: 0 });
      return;
    }
    setPartial({ sortField: apiSortFromUi(key), sortOrder: key === "date" || key === "severity" ? "desc" : "asc", page: 0 });
  };

  const bulkUpdate = async (nextStatus: FindingStatus) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await bulkUpdateFindings({
        ids: [...selected],
        action: "set_status",
        payload: { status: nextStatus },
      });
      setSelected(new Set());
      handleRetry();
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.totalBox}>
          <strong>{effectiveTotal}</strong>
          <span>находок</span>
        </div>
        <StackedSeverityBar counts={effectiveSeverityCounts} />
        <div className={styles.legend}>
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
            <span key={s} style={{ color: severityMeta[s].color, background: `${severityMeta[s].color}22` }}>
              {effectiveSeverityCounts[s] ?? 0} {severityMeta[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.group}>
          {sevFilters.map((f) => (
            <Pill
              key={f.key}
              active={f.key !== "all" && filters.severities.includes(f.key)}
              count={f.key === "all" ? effectiveTotal : effectiveSeverityCounts[f.key as Severity]}
              color={f.key === "all" ? "#64748b" : severityMeta[f.key as Severity].color}
              onClick={() =>
                setPartial({
                  severities: f.key === "all" ? [] : filters.severities[0] === f.key ? [] : [f.key as Severity],
                  page: 0,
                })
              }
            >
              {f.label}
            </Pill>
          ))}
        </div>
        <div className={styles.sep} />
        <div className={styles.group}>
          {typeFilters.map((f) => (
            <Pill
              key={f.key}
              active={f.key !== "all" && filters.categories.includes(f.key)}
              count={f.key === "all" ? effectiveTotal : effectiveTypeCounts[f.key]}
              color={f.key === "all" ? "#64748b" : typeMeta[f.key as FindingType]?.color}
              onClick={() =>
                setPartial({
                  categories: f.key === "all" ? [] : filters.categories[0] === f.key ? [] : [f.key as FindingType],
                  page: 0,
                })
              }
            >
              {f.key !== "all" ? `${typeMeta[f.key as FindingType].icon} ${f.label}` : f.label}
            </Pill>
          ))}
        </div>
        <div className={styles.sep} />
        <div className={styles.group}>
          {statusFilters.map((f) => (
            <Pill
              key={f.key}
              active={f.key !== "all" && filters.statuses.includes(f.key)}
              count={f.key === "all" ? effectiveTotal : statusCounts?.[f.key]}
              color={f.key === "all" ? "#64748b" : statusMeta[f.key]?.color ?? "#64748b"}
              onClick={() =>
                setPartial({ statuses: f.key === "all" ? [] : filters.statuses[0] === f.key ? [] : [f.key], page: 0 })
              }
            >
              {f.label}
            </Pill>
          ))}
        </div>
        <label className={styles.search}>
          🔎
          <input
            value={filters.search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPartial({ search: e.target.value, page: 0 })}
            placeholder="Поиск по title, id, tool"
          />
        </label>
      </div>

      <div className={styles.actions}>
        {selectionCount > 0 ? (
          <div className={styles.bulk}>
            <span>Выбрано: {selectionCount}</span>
            <button disabled={bulkLoading} onClick={() => bulkUpdate("under_review")}>
              Изм. статус
            </button>
            <button disabled={bulkLoading} onClick={() => setSelected(new Set())}>
              Очистить
            </button>
          </div>
        ) : (
          <span />
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>
          <span>{error}</span>
          <button onClick={handleRetry}>Повторить</button>
        </div>
      )}

      <div className={styles.table}>
        <div className={`${styles.row} ${styles.head}`}>
          <div>
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((x) => x.id)))} />
          </div>
          <div />
          <button onClick={() => toggleSort("title")}>Title</button>
          <button onClick={() => toggleSort("severity")}>Severity</button>
          <button onClick={() => toggleSort("status")}>Status</button>
          <button onClick={() => toggleSort("type")}>Type</button>
          <div>Product</div>
          <button onClick={() => toggleSort("date")}>Date</button>
        </div>

        {loading && rows.length === 0 ? (
          <div className={styles.empty}>Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>Нет находок по текущим фильтрам.</div>
        ) : (
          rows.map((f) => (
            <Link to={`/findings/${f.id}`} key={f.id} className={styles.row}>
              <div
                onClick={(e) => {
                  e.preventDefault();
                  const copy = new Set(selected);
                  copy.has(f.id) ? copy.delete(f.id) : copy.add(f.id);
                  setSelected(copy);
                }}
              >
                <span className={selected.has(f.id) ? styles.checked : styles.checkbox} />
              </div>
              <div
                className={styles.sevBar}
                style={{ background: severityMeta[f.severity].color, boxShadow: `0 0 6px ${severityMeta[f.severity].color}` }}
              />
              <div className={styles.titleCol}>
                <strong>{f.title}</strong>
                <span>
                  {f.id} • {f.tool}
                </span>
              </div>
              <div>
                <SevBadge severity={f.severity} />
              </div>
              <div>
                <StatusPill status={f.status} />
              </div>
              <div>
                <TypeBadge type={f.type} />
              </div>
              <div className={styles.product}>{f.product}</div>
              <div className={styles.date}>{f.firstSeen}</div>
            </Link>
          ))
        )}
      </div>

      <div className={styles.pagination}>
        <button
          disabled={filters.page === 0 || loading}
          onClick={() => setPartial({ page: Math.max(0, filters.page - 1) })}
        >
          ← Назад
        </button>
        <span>
          Страница {filters.page + 1}
          {totalKnown ? ` • всего ${effectiveTotal}` : ""}
        </span>
        <button disabled={(!hasNextPage && totalKnown) || loading} onClick={() => setPartial({ page: filters.page + 1 })}>
          Далее →
        </button>
      </div>
    </div>
  );
};

export default FindingsPage;

function mapFinding(raw: FindingListItemDTO) {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Без названия"),
    severity: normalizeSeverity(raw.severity),
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.category),
    product: String(raw.productName ?? "—"),
    tool: String(raw.scannerType ?? raw.sourceType ?? "unknown"),
    firstSeen: normalizeDate(raw.firstSeenAt ?? raw.lastSeenAt ?? raw.createdAt),
  };
}

function normalizeSeverity(value: unknown): Severity {
  const v = String(value ?? "").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low" || v === "info") return v;
  return "info";
}

function normalizeStatus(value: unknown): string {
  const v = String(value ?? "new");
  return v;
}

function normalizeType(value: unknown): FindingType {
  const v = String(value ?? "SAST").toUpperCase();
  if (v === "SAST" || v === "DAST" || v === "SCA" || v === "SECRETS" || v === "IAC") return v;
  return "SAST";
}
