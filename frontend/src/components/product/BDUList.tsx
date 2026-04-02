import { useEffect, useMemo, useState } from "react";
import { CircularProgress } from "@mui/material";
import styles from "./BDUList.module.css";
import type { BDUVulnerabilityItem } from "../../types/bdu";
import { listProductBduVulnerabilities } from "../../api/sbom";

type ThemeKey = "description" | "software" | "cvss" | "remediation" | "links";

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
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
};

const toText = (value: unknown): string => (typeof value === "string" ? value : "");
const toNum = (value: unknown): number | null => (typeof value === "number" ? value : null);
const toStrArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const parseDelimited = (value: unknown): string[] => {
  if (Array.isArray(value)) return toStrArray(value);
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
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
    dateUpdated: toText(raw.dateUpdated || raw.date_updated),
    cvss2:
      (raw.cvss2 || raw.cvssV2 || raw.cvss_v2) && typeof (raw.cvss2 || raw.cvssV2 || raw.cvss_v2) === "object"
        ? { vector: toText((raw.cvss2 || raw.cvssV2 || raw.cvss_v2).vector), score: toNum((raw.cvss2 || raw.cvssV2 || raw.cvss_v2).score) ?? 0 }
        : typeof raw.cvssV2 === "string" && Number.isFinite(Number.parseFloat(raw.cvssV2))
          ? { vector: "", score: Number.parseFloat(raw.cvssV2) }
        : null,
    cvss3:
      (raw.cvss3 || raw.cvss_v3) && typeof (raw.cvss3 || raw.cvss_v3) === "object"
        ? { vector: toText((raw.cvss3 || raw.cvss_v3).vector), score: toNum((raw.cvss3 || raw.cvss_v3).score) ?? 0 }
        : legacyCvss3 != null && Number.isFinite(legacyCvss3)
          ? { vector: "", score: legacyCvss3 }
          : null,
    cvss4:
      (raw.cvss4 || raw.cvssV4 || raw.cvss_v4) && typeof (raw.cvss4 || raw.cvssV4 || raw.cvss_v4) === "object"
        ? { vector: toText((raw.cvss4 || raw.cvssV4 || raw.cvss_v4).vector), score: toNum((raw.cvss4 || raw.cvssV4 || raw.cvss_v4).score) ?? 0 }
        : typeof raw.cvssV4 === "string" && Number.isFinite(Number.parseFloat(raw.cvssV4))
          ? { vector: "", score: Number.parseFloat(raw.cvssV4) }
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tabById, setTabById] = useState<Record<string, ThemeKey>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    listProductBduVulnerabilities(productId, {})
      .then((data) => {
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const normalized = rawItems
          .map(normalizeBduItem)
          .filter((item): item is BDUVulnerabilityItem => Boolean(item));
        setItems(normalized);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить уязвимости БДУ"))
      .finally(() => setLoading(false));
  }, [productId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.id, ...(item.otherIds || []), item.component || ""].join(" ").toLowerCase().includes(q));
  }, [items, query]);

  if (loading) {
    return (
      <div className={styles.stateLoading}>
        <CircularProgress size={20} />
        <span>Загрузка БДУ…</span>
      </div>
    );
  }
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.matched}>Matched: {filtered.length}</span>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по BDU ID / CVE / component"
        />
      </div>

      <div className={styles.header}>
        <span>CVSS</span>
        <span>Идентификатор / наименование</span>
        <span className={styles.cvssHead}>2.0 3.x 4.0</span>
      </div>

      {filtered.length === 0 && <div className={styles.state}>Нет совпадений по БДУ ФСТЭК.</div>}

      {filtered.map((item) => {
        const rowId = `${item.id}::${item.component || "unknown"}`;
        const score = bestScore(item);
        const sev = getSeverity(score);
        const isOpen = expanded === rowId;
        const activeTab = tabById[rowId] ?? "description";
        const theme = TAB_THEMES[activeTab];

        return (
          <article key={rowId} className={styles.rowWrap}>
            <button
              type="button"
              className={`${styles.row} ${isOpen ? styles.rowOpen : ""}`}
              style={{ borderLeftColor: sev.color } as React.CSSProperties}
              onClick={() => setExpanded(isOpen ? null : rowId)}
            >
              <div className={styles.severity} style={{ background: sev.bg, boxShadow: `inset 0 0 20px ${sev.glow}` }}>
                <strong>{score?.toFixed(1) ?? "—"}</strong>
                <span>{sev.level}</span>
              </div>

              <div className={styles.main}>
                <div className={styles.meta}>
                  <span className={styles.bduId}>{item.id}</span>
                  {item.component && <span className={styles.component}>{item.component}</span>}
                  {item.exploitExists && <span className={styles.exploit}>EXPLOIT</span>}
                </div>
                <p className={styles.name}>{item.name}</p>
              </div>

              <div className={styles.miniCols}>
                {miniCvss.map((c) => {
                  const s = item[c.key]?.score ?? null;
                  const cs = getSeverity(s);
                  return (
                    <span key={c.key} className={styles.miniPill} style={{ borderColor: cs.color, color: cs.color }}>
                      {c.label}: {s == null ? "—" : s.toFixed(1)}
                    </span>
                  );
                })}
                <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>▾</span>
              </div>
            </button>

            {isOpen && (
              <div className={styles.panel} style={{ background: theme.gradient, ["--accent" as string]: theme.accent } as React.CSSProperties}>
                <div className={styles.panelTabs}>
                  {(Object.keys(TAB_THEMES) as ThemeKey[]).map((key) => {
                    const tabTheme = TAB_THEMES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.panelTab} ${activeTab === key ? styles.panelTabActive : ""}`}
                        onClick={() => setTabById((prev) => ({ ...prev, [rowId]: key }))}
                      >
                        <span className={styles.tabIcon}>{tabTheme.icon}</span>
                        {tabTheme.label}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.content}>
                  <h4><span>{theme.icon}</span> {theme.label}</h4>
                  {activeTab === "description" && (
                    <>
                      <p className={styles.description}>{item.description || "Описание отсутствует."}</p>
                      <div className={styles.chips}>
                        {[item.vulnClass, item.cweId ? `${item.cweId}${item.cweDesc ? `: ${item.cweDesc}` : ""}` : "", item.vulnState, item.status]
                          .filter(Boolean)
                          .map((chip) => <span key={chip} className={styles.chip}>{chip}</span>)}
                      </div>
                      <div className={styles.dateGrid}>
                        <div><label>Выявлена</label><span>{formatDate(item.dateDiscovered)}</span></div>
                        <div><label>Опубликована</label><span>{formatDate(item.datePublished)}</span></div>
                        <div><label>Обновлена</label><span>{formatDate(item.dateUpdated)}</span></div>
                      </div>
                    </>
                  )}

                  {activeTab === "software" && (
                    <div className={styles.grid}>
                      {[
                        ["Вендор", item.vendor], ["Продукт", item.softwareName], ["Версия", item.softwareVersion],
                        ["Тип ПО", item.softwareType], ["ОС/Платформа", item.osPlatform], ["Способ эксплуатации", item.exploitMethod],
                        ["Доп. информация", item.additionalInfo], ["Связь с инцидентами", item.incidentRelation],
                      ].map(([k, v]) => <div key={k}><label>{k}</label><span>{v || "—"}</span></div>)}
                    </div>
                  )}

                  {activeTab === "cvss" && (
                    <div className={styles.cvssGrid}>
                      {miniCvss.map((c) => {
                        const data = item[c.key];
                        const value = data?.score ?? null;
                        const cs = getSeverity(value);
                        return (
                          <div key={c.key} className={styles.cvssCard}>
                            <header>{c.label}</header>
                            <strong style={{ color: cs.color }}>{value == null ? "Не применимо" : value.toFixed(1)}</strong>
                            <div className={styles.progress}><i style={{ width: `${Math.max(0, Math.min((value ?? 0) * 10, 100))}%`, background: cs.color }} /></div>
                            <code>{data?.vector || "Не применимо"}</code>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === "remediation" && (
                    <>
                      <div className={styles.notice}>🛠 {item.remediation || "Рекомендации отсутствуют."}</div>
                      <div className={styles.grid}>
                        <div><label>Способ устранения</label><span>{item.fixMethod || "—"}</span></div>
                        <div><label>Информация</label><span>{item.fixInfo || "—"}</span></div>
                      </div>
                      <div className={styles.exploitLine}>
                        <span className={`${styles.dot} ${item.exploitExists ? styles.dotOn : ""}`} />
                        Эксплойт: {item.exploitExists ? "обнаружен" : "не выявлен"}
                      </div>
                    </>
                  )}

                  {activeTab === "links" && (
                    <div className={styles.linksGrid}>
                      <div className={styles.chips}>
                        {(item.otherIds || []).map((oid) => <span key={oid} className={styles.cve}>{oid}</span>)}
                      </div>
                      <div className={styles.refs}>
                        {(item.references || []).map((ref) => (
                          <a key={ref} href={ref} target="_blank" rel="noreferrer">↗ {ref}</a>
                        ))}
                      </div>
                    </div>
                  )}
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
