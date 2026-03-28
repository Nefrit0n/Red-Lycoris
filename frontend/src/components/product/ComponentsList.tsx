import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { listProductComponents } from "../../api/sbom";
import styles from "./ComponentsList.module.css";

type CycloneDxHash = {
  alg?: string | null;
  content?: string | null;
};

type CycloneDxComponent = {
  bomRef?: string | null;
  type?: string | null;
  group?: string | null;
  name?: string | null;
  version?: string | null;
  cpe?: string | null;
  purl?: string | null;
  ecosystem?: string | null;
  language?: string | null;
  packageType?: string | null;
  foundBy?: string | null;
  licenses?: string[] | null;
  hashes?: CycloneDxHash[] | null;
  location?: string | null;
  layerId?: string | null;
  vulns?: number | null;
  dependsOn?: string[] | null;
  dependedBy?: string[] | null;
};

type SortColumn = "name" | "version" | "ecosystem" | "vulns" | "deps";
type SortDirection = "asc" | "desc";
type DetailTab = "identity" | "deps" | "location" | "hashes";

const ECO_CFG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  maven: { color: "#f97316", bg: "#431407", icon: "M", label: "Maven" },
  npm: { color: "#ef4444", bg: "#450a0a", icon: "N", label: "npm" },
  deb: { color: "#a855f7", bg: "#3b0764", icon: "D", label: "Deb" },
  pypi: { color: "#3b82f6", bg: "#172554", icon: "P", label: "PyPI" },
  go: { color: "#06b6d4", bg: "#083344", icon: "G", label: "Go" },
  other: { color: "#64748b", bg: "#1e293b", icon: "?", label: "Other" },
};

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  library: { label: "lib", color: "#60a5fa" },
  framework: { label: "frm", color: "#a78bfa" },
  application: { label: "app", color: "#34d399" },
  container: { label: "ctr", color: "#f472b6" },
  firmware: { label: "fw", color: "#fbbf24" },
  file: { label: "file", color: "#94a3b8" },
  os: { label: "os", color: "#fb923c" },
};

const DETAIL_TABS: Record<DetailTab, { label: string; accent: string; icon: string; gradient: string }> = {
  identity: {
    label: "Идентификация",
    accent: "#60a5fa",
    icon: "🪪",
    gradient: "linear-gradient(180deg, #0c1a2e 0%, #080d19 100%)",
  },
  deps: {
    label: "Зависимости",
    accent: "#c084fc",
    icon: "🔗",
    gradient: "linear-gradient(180deg, #150e2e 0%, #080d19 100%)",
  },
  location: {
    label: "Расположение",
    accent: "#34d399",
    icon: "📁",
    gradient: "linear-gradient(180deg, #0a1f17 0%, #080d19 100%)",
  },
  hashes: {
    label: "Хеши",
    accent: "#f59e0b",
    icon: "#",
    gradient: "linear-gradient(180deg, #1a1508 0%, #080d19 100%)",
  },
};

const LIC_COLORS: Record<string, string> = {
  apache: "#22c55e",
  mit: "#3b82f6",
  gpl: "#f59e0b",
};

const pickLicenseColor = (license: string): string => {
  const l = license.toLowerCase();
  if (l.includes("apache")) return LIC_COLORS.apache;
  if (l.includes("mit")) return LIC_COLORS.mit;
  if (l.includes("gpl")) return LIC_COLORS.gpl;
  return "#64748b";
};

const toArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
const toStringSafe = (value: string | null | undefined): string => value || "";
const toNumberSafe = (value: number | null | undefined): number => (typeof value === "number" ? value : 0);

const normalizeRawComponent = (raw: any): CycloneDxComponent => {
  const licenses = Array.isArray(raw?.licenses)
    ? raw.licenses
        .map((l: unknown) => {
          if (typeof l === "string") return l;
          if (l && typeof l === "object" && "license" in (l as Record<string, unknown>)) {
            const nested = (l as Record<string, any>).license;
            return typeof nested?.id === "string" ? nested.id : typeof nested?.name === "string" ? nested.name : "";
          }
          return "";
        })
        .filter(Boolean)
    : [];

  const hashes = Array.isArray(raw?.hashes)
    ? raw.hashes
        .map((h: any) => ({
          alg: typeof h?.alg === "string" ? h.alg : "",
          content: typeof h?.content === "string" ? h.content : "",
        }))
        .filter((h: CycloneDxHash) => Boolean(h.alg || h.content))
    : [];

  return {
    bomRef: toStringSafe(raw?.bomRef || raw?.["bom-ref"]),
    type: toStringSafe(raw?.type),
    group: toStringSafe(raw?.group),
    name: toStringSafe(raw?.name),
    version: toStringSafe(raw?.version),
    cpe: toStringSafe(raw?.cpe),
    purl: toStringSafe(raw?.purl),
    ecosystem: toStringSafe(raw?.ecosystem),
    language: toStringSafe(raw?.language),
    packageType: toStringSafe(raw?.packageType),
    foundBy: toStringSafe(raw?.foundBy),
    licenses,
    hashes,
    location: toStringSafe(raw?.location),
    layerId: toStringSafe(raw?.layerId),
    vulns: toNumberSafe(raw?.vulns ?? raw?.vulnTotal),
    dependsOn: toArray(raw?.dependsOn),
    dependedBy: toArray(raw?.dependedBy),
  };
};

const compareBy = (a: CycloneDxComponent, b: CycloneDxComponent, sortBy: SortColumn): number => {
  switch (sortBy) {
    case "name":
      return toStringSafe(a.name).localeCompare(toStringSafe(b.name));
    case "version":
      return toStringSafe(a.version).localeCompare(toStringSafe(b.version));
    case "ecosystem":
      return toStringSafe(a.ecosystem).localeCompare(toStringSafe(b.ecosystem));
    case "vulns":
      return toNumberSafe(a.vulns) - toNumberSafe(b.vulns);
    case "deps":
      return toArray(a.dependsOn).length - toArray(b.dependsOn).length;
    default:
      return 0;
  }
};

const fetchCycloneDxComponents = async (productId: string): Promise<CycloneDxComponent[]> => {
  const response = await listProductComponents(productId, { limit: 500, offset: 0 });
  const raw = Array.isArray((response as any)?.items)
    ? (response as any).items
    : Array.isArray(response)
      ? response
      : [];
  return raw.map(normalizeRawComponent);
};

const SortArrow = ({ active, dir }: { active: boolean; dir: SortDirection }) => (
  <span className={styles.sortIcon} aria-hidden="true">
    <span className={`${styles.sortUp} ${active && dir === "asc" ? styles.sortActive : ""}`}>▲</span>
    <span className={`${styles.sortDown} ${active && dir === "desc" ? styles.sortActive : ""}`}>▼</span>
  </span>
);

const TypeBadge = ({ type }: { type?: string | null }) => {
  const cfg = TYPE_CFG[toStringSafe(type).toLowerCase()] || { label: "?", color: "#64748b" };
  return (
    <span className={styles.typeBadge} style={{ color: cfg.color, background: `${cfg.color}15` }}>
      {cfg.label}
    </span>
  );
};

const EcosystemBadge = ({ ecosystem, compact = false }: { ecosystem?: string | null; compact?: boolean }) => {
  const cfg = ECO_CFG[toStringSafe(ecosystem).toLowerCase()] || ECO_CFG.other;
  return (
    <span
      className={compact ? styles.ecoBadgeCompact : styles.ecoBadge}
      style={{ background: cfg.bg, borderColor: `${cfg.color}22` }}
      title={cfg.label}
    >
      <span className={styles.ecoIcon} style={{ color: cfg.color, background: `${cfg.color}20` }}>
        {cfg.icon}
      </span>
      {!compact && (
        <span className={styles.ecoLabel} style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      )}
    </span>
  );
};

const ComponentsList = ({ productId }: { productId: string }) => {
  const [components, setComponents] = useState<CycloneDxComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [ecoFilter, setEcoFilter] = useState("all");
  const [vulnOnly, setVulnOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [detailTabByRef, setDetailTabByRef] = useState<Record<string, DetailTab>>({});

  useEffect(() => {
    setLoading(true);
    fetchCycloneDxComponents(productId)
      .then((items) => {
        setComponents(items);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить компоненты"))
      .finally(() => setLoading(false));
  }, [productId]);

  const ecosystems = useMemo(
    () => Array.from(new Set(components.map((c) => toStringSafe(c.ecosystem).toLowerCase()).filter(Boolean))),
    [components],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = components.filter((c) => {
      if (q) {
        const haystack = [c.name, c.group, c.purl, c.cpe].map((item) => toStringSafe(item).toLowerCase());
        if (!haystack.some((v) => v.includes(q))) return false;
      }
      if (ecoFilter !== "all" && toStringSafe(c.ecosystem).toLowerCase() !== ecoFilter) return false;
      if (vulnOnly && toNumberSafe(c.vulns) === 0) return false;
      return true;
    });
    return result.sort((a, b) => {
      const compared = compareBy(a, b, sortBy);
      return sortDir === "asc" ? compared : compared * -1;
    });
  }, [components, search, ecoFilter, vulnOnly, sortBy, sortDir]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const withVulns = filtered.filter((c) => toNumberSafe(c.vulns) > 0).length;
    const totalVulns = filtered.reduce((acc, c) => acc + toNumberSafe(c.vulns), 0);
    const ecosystemsInView = Array.from(
      new Set(filtered.map((c) => toStringSafe(c.ecosystem).toLowerCase()).filter(Boolean)),
    );
    const languages = Array.from(new Set(filtered.map((c) => toStringSafe(c.language)).filter(Boolean)));
    return { total, withVulns, totalVulns, ecosystemsInView, languages };
  }, [filtered]);

  const toggleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  };

  const setTabForComponent = (key: string, tab: DetailTab) => {
    setDetailTabByRef((prev) => ({ ...prev, [key]: tab }));
  };

  const renderDetailTab = (component: CycloneDxComponent, tab: DetailTab) => {
    if (tab === "identity") {
      return (
        <div className={styles.detailsContentBlock}>
          <DetailField label="PURL" value={component.purl || "—"} mono wide />
          <DetailField label="CPE" value={component.cpe || "—"} mono wide />
          <DetailField label="bom-ref" value={component.bomRef || "—"} mono wide tiny />
          <div className={styles.identityGrid}>
            <DetailField label="Group" value={component.group || "—"} mono />
            <DetailField label="Type" value={component.type || "—"} badge={<TypeBadge type={component.type} />} />
            <DetailField label="Language" value={component.language || "—"} />
            <DetailField label="Package Type" value={component.packageType || "—"} mono />
            <DetailField label="Found By" value={component.foundBy || "—"} />
          </div>
        </div>
      );
    }

    if (tab === "deps") {
      const dependsOn = toArray(component.dependsOn);
      const dependedBy = toArray(component.dependedBy);
      return (
        <div className={styles.depsGrid}>
          <div>
            <div className={styles.depHeaderBlue}>▸ DEPENDS ON ({dependsOn.length})</div>
            {dependsOn.length === 0 ? (
              <div className={styles.emptyState}>Нет зависимостей</div>
            ) : (
              <div className={styles.pillList}>
                {dependsOn.map((item) => (
                  <span key={item} className={styles.depPillBlue}>{item}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className={styles.depHeaderPurple}>◂ DEPENDED BY ({dependedBy.length})</div>
            {dependedBy.length === 0 ? (
              <div className={styles.emptyState}>Нет зависимых</div>
            ) : (
              <div className={styles.pillList}>
                {dependedBy.map((item) => (
                  <span key={item} className={styles.depPillPurple}>{item}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tab === "location") {
      return (
        <div className={styles.detailsContentBlock}>
          <DetailField label="Path" value={component.location || "—"} mono wide />
          <DetailField label="Layer ID" value={component.layerId || "—"} mono wide tiny />
        </div>
      );
    }

    const hashes = toArray(component.hashes);
    return (
      <div>
        {hashes.length === 0 ? (
          <div className={styles.emptyState}>Хеши отсутствуют в SBOM</div>
        ) : (
          <div className={styles.hashList}>
            {hashes.map((hash, index) => (
              <div key={`${hash.alg}-${index}`} className={styles.hashRow}>
                <span className={styles.hashAlg}>{hash.alg || "HASH"}</span>
                <span className={styles.hashValue}>{hash.content || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={styles.container}>
      <div className={styles.statsBar}>
        <StatCard label="Компонентов" value={stats.total} />
        <StatCard label="С уязвимостями" value={stats.withVulns} alert={stats.withVulns > 0} />
        <StatCard label="Всего уязвимостей" value={stats.totalVulns} alert={stats.totalVulns > 0} />
        <div className={styles.statTagsBlock}>
          <div className={styles.tagsTitle}>Экосистемы</div>
          <div className={styles.tagsWrap}>
            {stats.ecosystemsInView.length === 0 ? <span className={styles.muted}>—</span> : null}
            {stats.ecosystemsInView.map((eco) => (
              <EcosystemBadge key={eco} ecosystem={eco} />
            ))}
          </div>
        </div>
        <div className={styles.statTagsBlock}>
          <div className={styles.tagsTitle}>Языки</div>
          <div className={styles.tagsWrap}>
            {stats.languages.length === 0 ? <span className={styles.muted}>—</span> : null}
            {stats.languages.map((lang) => (
              <span key={lang} className={styles.languageTag}>{lang}</span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setExpandedIdx(null);
          }}
          placeholder="Поиск: name / group / purl / cpe"
        />

        <div className={styles.filterPills}>
          <button
            type="button"
            className={`${styles.pill} ${ecoFilter === "all" ? styles.pillActive : ""}`}
            onClick={() => setEcoFilter("all")}
          >
            Все
          </button>
          {ecosystems.map((eco) => {
            const cfg = ECO_CFG[eco] || ECO_CFG.other;
            return (
              <button
                key={eco}
                type="button"
                className={`${styles.pill} ${ecoFilter === eco ? styles.pillActive : ""}`}
                style={{ "--pill-color": cfg.color } as CSSProperties}
                onClick={() => setEcoFilter(eco)}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        <label className={styles.vulnOnly}>
          <input type="checkbox" checked={vulnOnly} onChange={(event) => setVulnOnly(event.target.checked)} />
          С уязвимостями
        </label>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.headerRow}>
          <div className={styles.headerCellEmpty} />
          <SortableHeader label="Компонент" active={sortBy === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
          <SortableHeader label="Версия" active={sortBy === "version"} dir={sortDir} onClick={() => toggleSort("version")} />
          <SortableHeader label="Экосистема" active={sortBy === "ecosystem"} dir={sortDir} onClick={() => toggleSort("ecosystem")} center />
          <SortableHeader label="Vulns" active={sortBy === "vulns"} dir={sortDir} onClick={() => toggleSort("vulns")} center />
          <SortableHeader label="Deps" active={sortBy === "deps"} dir={sortDir} onClick={() => toggleSort("deps")} center />
          <div className={`${styles.headerCell} ${styles.center}`}>Used</div>
          <div className={styles.headerCell}>Лицензия</div>
        </div>

        {loading && <div className={styles.empty}>Загрузка компонентов…</div>}
        {!loading && error && <div className={styles.empty}>Ошибка: {error}</div>}

        {!loading && !error && filtered.length === 0 ? <div className={styles.empty}>Компоненты не найдены</div> : null}

        {!loading &&
          !error &&
          filtered.map((component, idx) => {
            const open = expandedIdx === idx;
            const hot = toNumberSafe(component.vulns) > 0;
            const key = component.bomRef || `${component.name}-${component.version}-${idx}`;
            const activeTab = detailTabByRef[key] || "identity";
            const tabCfg = DETAIL_TABS[activeTab];
            return (
              <div key={key}>
                <button
                  type="button"
                  className={`${styles.row} ${open ? styles.rowOpen : ""} ${hot ? styles.rowHot : ""}`}
                  onClick={() => setExpandedIdx(open ? null : idx)}
                >
                  <span className={styles.chevron}>{open ? "▸" : "▸"}</span>

                  <div className={styles.componentCell}>
                    <div className={styles.componentNameLine}>
                      <TypeBadge type={component.type} />
                      <span className={styles.componentName}>{component.name || "—"}</span>
                    </div>
                    {component.group ? <div className={styles.componentGroup}>{component.group}</div> : null}
                  </div>

                  <div className={styles.version}>{component.version || "—"}</div>
                  <div className={styles.center}><EcosystemBadge ecosystem={component.ecosystem} compact /></div>
                  <div className={styles.center}>
                    <span className={toNumberSafe(component.vulns) > 0 ? styles.vulnBadgeHot : styles.vulnBadgeCold}>
                      {toNumberSafe(component.vulns)}
                    </span>
                  </div>
                  <div className={styles.center}><span className={styles.depsBlue}>{toArray(component.dependsOn).length}</span></div>
                  <div className={styles.center}><span className={styles.depsPurple}>{toArray(component.dependedBy).length}</span></div>
                  <div className={styles.licensesCell}>
                    {toArray(component.licenses).length === 0 ? (
                      <span className={styles.muted}>—</span>
                    ) : (
                      <div className={styles.licenseWrap}>
                        {toArray(component.licenses).map((license) => {
                          const color = pickLicenseColor(license);
                          return (
                            <span
                              key={license}
                              className={styles.licenseTag}
                              style={{ color, background: `${color}14`, borderColor: `${color}18` }}
                            >
                              {license}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>

                {open ? (
                  <div className={styles.detailsWrap}>
                    <div className={styles.detailsTabs} style={{ borderBottomColor: `${tabCfg.accent}30` }}>
                      {(Object.keys(DETAIL_TABS) as DetailTab[]).map((tab) => {
                        const cfg = DETAIL_TABS[tab];
                        const isActive = activeTab === tab;
                        return (
                          <button
                            key={tab}
                            type="button"
                            className={`${styles.detailsTabBtn} ${isActive ? styles.detailsTabActive : ""}`}
                            style={
                              {
                                "--accent": cfg.accent,
                                "--tab-bg": isActive ? `${cfg.accent}10` : "transparent",
                              } as CSSProperties
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              setTabForComponent(key, tab);
                            }}
                          >
                            {cfg.icon} {cfg.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className={styles.detailsContent} style={{ background: tabCfg.gradient, "--accent": tabCfg.accent } as CSSProperties}>
                      <div className={styles.accentLine} />
                      {renderDetailTab(component, activeTab)}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>

      <div className={styles.counter}>{filtered.length} из {components.length}</div>
    </section>
  );
};

const SortableHeader = ({
  label,
  active,
  dir,
  onClick,
  center,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
  center?: boolean;
}) => (
  <button type="button" className={`${styles.headerCell} ${center ? styles.center : ""}`} onClick={onClick}>
    {label}
    <SortArrow active={active} dir={dir} />
  </button>
);

const StatCard = ({ label, value, alert }: { label: string; value: number; alert?: boolean }) => (
  <div className={`${styles.statCard} ${alert ? styles.statAlert : ""}`}>
    <div className={styles.statLabel}>{label}</div>
    <div className={styles.statValue}>{value}</div>
  </div>
);

const DetailField = ({
  label,
  value,
  mono,
  wide,
  tiny,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
  tiny?: boolean;
  badge?: ReactNode;
}) => (
  <div className={`${styles.detailField} ${wide ? styles.detailFieldWide : ""}`}>
    <div className={styles.detailFieldLabel}>
      {label}
      {badge ? <span>{badge}</span> : null}
    </div>
    <div className={`${styles.detailFieldValue} ${mono ? styles.mono : ""} ${tiny ? styles.tiny : ""}`}>{value}</div>
  </div>
);

export default ComponentsList;
