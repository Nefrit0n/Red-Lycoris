import { useEffect, useMemo, useState } from "react";
import { CircularProgress } from "@mui/material";
import styles from "./BDUList.module.css";
import type { BDUVulnerabilityItem, BduDatasetStatus, BduIndexStatus } from "../../types/bdu";
import { listProductBduVulnerabilities } from "../../api/sbom";

type ThemeKey = "description" | "software" | "cvss" | "remediation" | "links";
type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "unknown";

const TAB_THEMES: Record<ThemeKey, { label: string; accent: string; gradient: string; icon: string }> = {
  description: { label: "Описание", accent: "#60a5fa", gradient: "linear-gradient(180deg, #0c1a2e 0%, #0a0f1a 100%)", icon: "📝" },
  software: { label: "ПО и платформа", accent: "#a78bfa", gradient: "linear-gradient(180deg, #150e2e 0%, #0a0f1a 100%)", icon: "🖥" },
  cvss: { label: "CVSS", accent: "#f59e0b", gradient: "linear-gradient(180deg, #1a1508 0%, #0a0f1a 100%)", icon: "📊" },
  remediation: { label: "Устранение", accent: "#34d399", gradient: "linear-gradient(180deg, #0a1f17 0%, #0a0f1a 100%)", icon: "🛡" },
  links: { label: "Ссылки", accent: "#f472b6", gradient: "linear-gradient(180deg, #1f0a1a 0%, #0a0f1a 100%)", icon: "🔗" },
};

const miniCvss = [
  { key: "cvss2", label: "2.0" },
  { key: "cvss3", label: "3.x" },
  { key: "cvss4", label: "4.0" },
] as const;

const bestScore = (v: BDUVulnerabilityItem): number | null => v.cvss4?.score ?? v.cvss3?.score ?? v.cvss2?.score ?? null;
const getSeverityBucket = (score: number | null): SeverityFilter => {
  if (score == null) return "unknown";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
};

const getSeverity = (score: number | null) => {
  if (score == null) return { level: "—", color: "#64748b", bg: "#0f172a", glow: "transparent" };
  if (score >= 9) return { level: "КРИТ", color: "#dc2626", bg: "rgba(220,38,38,0.18)", glow: "rgba(220,38,38,0.35)" };
  if (score >= 7) return { level: "ВЫС", color: "#ea580c", bg: "rgba(234,88,12,0.18)", glow: "rgba(234,88,12,0.35)" };
  if (score >= 4) return { level: "СР", color: "#ca8a04", bg: "rgba(202,138,4,0.18)", glow: "rgba(202,138,4,0.35)" };
  return { level: "НИЗ", color: "#16a34a", bg: "rgba(22,163,74,0.2)", glow: "rgba(22,163,74,0.35)" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(dt);
};

const toText = (value: unknown): string => (typeof value === "string" ? value : "");
const toNum = (value: unknown): number | null => (typeof value === "number" ? value : null);
const toStrArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const parseDelimited = (value: unknown): string[] => {
  if (Array.isArray(value)) return toStrArray(value);
  if (typeof value !== "string") return [];
  return value.split(/[\n,;]+/g).map((item) => item.trim()).filter(Boolean);
};
const toBool = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === "string") {
    const norm = value.trim().toLowerCase();
    return norm === "true" || norm === "1" || norm === "yes" || norm === "да";
  }
  return false;
};

const normalizeBduItem = (raw: any): BDUVulnerabilityItem | null => {
  if (!raw || typeof raw !== "object") return null;

  const id = toText(raw.id || raw.identifier || raw.bduId || raw.bdu_id);
  const legacyCvss3 = typeof raw.cvssV3 === "string" ? Number.parseFloat(raw.cvssV3) : null;
  const componentName = toText(raw.component || raw.componentName || raw.component_name);
  const componentVersion = toText(raw.componentVersion || raw.component_version);
  const component = componentName && componentVersion ? `${componentName} ${componentVersion}` : componentName || componentVersion;

  if (!id) return null;

  return {
    id,
    name: toText(raw.name),
    description: toText(raw.description || raw.bduDescription),
    vendor: toText(raw.vendor),
    softwareName: toText(raw.softwareName),
    softwareVersion: toText(raw.softwareVersion),
    softwareType: toText(raw.softwareType),
    osPlatform: toText(raw.osPlatform || raw.osHardware),
    vulnClass: toText(raw.vulnClass),
    dateDiscovered: toText(raw.dateDiscovered || raw.detectionDate || raw.date_discovered),
    datePublished: toText(raw.datePublished || raw.publishedDate || raw.date_published || raw.published_date),
    dateUpdated: toText(raw.dateUpdated || raw.updatedDate || raw.date_updated),
    cvss2: (raw.cvss2 || raw.cvssV2 || raw.cvss_v2) && typeof (raw.cvss2 || raw.cvssV2 || raw.cvss_v2) === "object"
      ? { vector: toText((raw.cvss2 || raw.cvssV2 || raw.cvss_v2).vector), score: toNum((raw.cvss2 || raw.cvssV2 || raw.cvss_v2).score) ?? 0 }
      : null,
    cvss3: (raw.cvss3 || raw.cvss_v3) && typeof (raw.cvss3 || raw.cvss_v3) === "object"
      ? { vector: toText((raw.cvss3 || raw.cvss_v3).vector), score: toNum((raw.cvss3 || raw.cvss_v3).score) ?? 0 }
      : legacyCvss3 != null && Number.isFinite(legacyCvss3)
        ? { vector: "", score: legacyCvss3 }
        : null,
    cvss4: (raw.cvss4 || raw.cvssV4 || raw.cvss_v4) && typeof (raw.cvss4 || raw.cvssV4 || raw.cvss_v4) === "object"
      ? { vector: toText((raw.cvss4 || raw.cvssV4 || raw.cvss_v4).vector), score: toNum((raw.cvss4 || raw.cvssV4 || raw.cvss_v4).score) ?? 0 }
      : null,
    remediation: toText(raw.remediation),
    status: toText(raw.status),
    exploitExists: toBool(raw.exploitExists ?? raw.exploit_exists),
    fixInfo: toText(raw.fixInfo),
    references: parseDelimited(raw.references || raw.sourceUrls || raw.source_urls),
    otherIds: parseDelimited(raw.otherIds || raw.other_ids || raw.cve_ids),
    vulnState: toText(raw.vulnState || raw.vuln_state),
    cweId: toText(raw.cweId || raw.cwe_id),
    cweDesc: toText(raw.cweDesc || raw.cweDescription || raw.cwe_description),
    exploitMethod: toText(raw.exploitMethod || raw.exploitationMethod),
    fixMethod: toText(raw.fixMethod),
    incidentRelation: toText(raw.incidentRelation || raw.incidentInfo || raw.incident_info),
    additionalInfo: toText(raw.additionalInfo || raw.otherInfo || raw.other_info),
    component,
  };
};

const BDUList = ({ productId }: { productId: string }) => {
  const [items, setItems] = useState<BDUVulnerabilityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tabById, setTabById] = useState<Record<string, ThemeKey>>({});
  const [indexStatus, setIndexStatus] = useState<BduIndexStatus | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<BduDatasetStatus | null>(null);
  const [rawTotal, setRawTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchState = async () => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await listProductBduVulnerabilities(productId, {});
        if (cancelled) return;
        setIndexStatus(data.indexStatus ?? null);
        setDatasetStatus(data.datasetStatus ?? null);
        setRawTotal(data.total || 0);
        const normalized = (Array.isArray(data.items) ? data.items : [])
          .map(normalizeBduItem)
          .filter((item): item is BDUVulnerabilityItem => Boolean(item));
        setItems(normalized);

        const status = (data.indexStatus?.status || "").toLowerCase();
        const shouldPoll = ["queued", "processing", "running", "pending"].includes(status);
        if (shouldPoll) {
          timer = setTimeout(fetchState, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить уязвимости БДУ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchState();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [productId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = [item.id, ...(item.otherIds || []), item.component || "", item.name, item.softwareName].join(" ").toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesSeverity = severityFilter === "all" || getSeverityBucket(bestScore(item)) === severityFilter;
      return matchesQuery && matchesSeverity;
    });
  }, [items, query, severityFilter]);

  const matchedComponents = useMemo(() => new Set(filtered.map((i) => i.component).filter(Boolean)).size, [filtered]);
  const status = (indexStatus?.status || "missing").toLowerCase();

  const renderState = () => {
    if (status === "missing") return <div className={styles.state}>SBOM ещё не загружен.</div>;
    if (["queued", "processing", "running", "pending"].includes(status)) {
      return <div className={styles.stateLoading}><CircularProgress size={20} /><span>Индексация SBOM выполняется. Матчи БДУ появятся автоматически…</span></div>;
    }
    if (!datasetStatus?.isLoaded) return <div className={styles.state}>Датасет БДУ не загружен. Дождитесь синхронизации базы БДУ ФСТЭК.</div>;
    if (filtered.length === 0) return <div className={styles.state}>Совпадений не найдено после завершения индексации.</div>;
    return null;
  };

  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <section className={styles.wrap}>
      <div className={styles.summaryRow}>
        <div><small>Совпадений уязвимостей</small><strong>{rawTotal}</strong></div>
        <div><small>Совпавших компонентов</small><strong>{matchedComponents}</strong></div>
        <div><small>Синхронизация БДУ</small><strong>{formatDate(datasetStatus?.syncedAt)}</strong></div>
        <div><small>Записей в датасете</small><strong>{datasetStatus?.vulnerabilityCount ?? 0} / {datasetStatus?.componentCount ?? 0}</strong></div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: BDU ID / CVE / компонент" />
        <select className={styles.select} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}>
          <option value="all">Все уровни</option>
          <option value="critical">Критические</option>
          <option value="high">Высокие</option>
          <option value="medium">Средние</option>
          <option value="low">Низкие</option>
          <option value="unknown">Без CVSS</option>
        </select>
      </div>

      <div className={styles.header}><span>CVSS</span><span>Идентификатор / наименование</span><span className={styles.cvssHead}>Детали</span></div>
      {loading && <div className={styles.stateLoading}><CircularProgress size={18} /><span>Обновление данных…</span></div>}
      {renderState()}

      {filtered.map((item) => {
        const rowId = `${item.id}::${item.component || "unknown"}`;
        const score = bestScore(item);
        const sev = getSeverity(score);
        const isOpen = expanded === rowId;
        const activeTab = tabById[rowId] ?? "description";
        const theme = TAB_THEMES[activeTab];

        return (
          <article key={rowId} className={styles.rowWrap}>
            <button type="button" className={`${styles.row} ${isOpen ? styles.rowOpen : ""}`} style={{ borderLeftColor: sev.color } as React.CSSProperties} onClick={() => setExpanded(isOpen ? null : rowId)}>
              <div className={styles.severity} style={{ background: sev.bg, boxShadow: `inset 0 0 20px ${sev.glow}` }}><strong>{score?.toFixed(1) ?? "—"}</strong><span>{sev.level}</span></div>
              <div className={styles.main}>
                <div className={styles.meta}><span className={styles.bduId}>{item.id}</span>{item.component && <span className={styles.component}>{item.component}</span>}{item.exploitExists && <span className={styles.exploit}>EXPLOIT</span>}</div>
                <p className={styles.name}>{item.name}</p>
                <div className={styles.stats}>Источники: {item.references.length} · CWE: {item.cweId || "—"}</div>
              </div>
              <div className={styles.miniCols}>{miniCvss.map((c) => <span key={c.key} className={styles.miniPill}>{c.label}: {item[c.key]?.score?.toFixed(1) ?? "—"}</span>)}<span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>▾</span></div>
            </button>

            {isOpen && (
              <div className={styles.panel} style={{ background: theme.gradient, ["--accent" as string]: theme.accent } as React.CSSProperties}>
                <div className={styles.panelTabs}>{(Object.keys(TAB_THEMES) as ThemeKey[]).map((key) => <button key={key} type="button" className={`${styles.panelTab} ${activeTab === key ? styles.panelTabActive : ""}`} onClick={() => setTabById((prev) => ({ ...prev, [rowId]: key }))}><span className={styles.tabIcon}>{TAB_THEMES[key].icon}</span>{TAB_THEMES[key].label}</button>)}</div>
                <div className={styles.content}>
                  <h4><span>{theme.icon}</span> {theme.label}</h4>
                  {activeTab === "description" && <><p className={styles.description}>{item.description || "Описание отсутствует."}</p><div className={styles.chips}> {[item.vulnClass, item.vulnState, item.status, item.cweId].filter(Boolean).map((chip) => <span key={chip} className={styles.chip}>{chip}</span>)} </div><div className={styles.dateGrid}><div><label>Выявлена</label><span>{formatDate(item.dateDiscovered)}</span></div><div><label>Опубликована</label><span>{formatDate(item.datePublished)}</span></div><div><label>Обновлена</label><span>{formatDate(item.dateUpdated)}</span></div></div></>}
                  {activeTab === "software" && <div className={styles.grid}>{[["Вендор", item.vendor], ["ПО", item.softwareName], ["Версия", item.softwareVersion], ["Тип ПО", item.softwareType], ["ОС/Платформа", item.osPlatform], ["Совпавший компонент", item.component], ["Эксплуатация", item.exploitMethod]].map(([k, v]) => <div key={k}><label>{k}</label><span>{v || "—"}</span></div>)}</div>}
                  {activeTab === "cvss" && <div className={styles.cvssGrid}>{miniCvss.map((c) => <div key={c.key} className={styles.cvssCard}><header>{c.label}</header><strong>{item[c.key]?.score?.toFixed(1) ?? "—"}</strong><code>{item[c.key]?.vector || "n/a"}</code></div>)}</div>}
                  {activeTab === "remediation" && <><div className={styles.notice}>🛠 {item.remediation || "Рекомендации отсутствуют."}</div><div className={styles.grid}><div><label>Устранение</label><span>{item.fixMethod || "—"}</span></div><div><label>Инфо</label><span>{item.fixInfo || "—"}</span></div></div></>}
                  {activeTab === "links" && <div className={styles.refs}>{(item.references || []).map((ref) => <a key={ref} href={ref} target="_blank" rel="noreferrer">↗ {ref}</a>)}</div>}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};

export default BDUList;
