import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProductDetail } from "../hooks/useProductDetail";
import { calculateHealthScore } from "../utils/productHealth";
import { listSboms } from "../api/sbom";
import type { SbomItem } from "../types/sbom";
import styles from "./ProductDetail.module.css";

type SbomTab = "sbom" | "components" | "bdu";

type SeveritySummaryItem = { label: string; value: number; color: string };

type ToolConfig = {
  label: string;
  icon: string;
  category: string;
  color: string;
};

const TOOL_CONFIG: Record<string, ToolConfig> = {
  zap: { label: "ZAP", icon: "⚡", category: "DAST", color: "#3b82f6" },
  trufflehog: { label: "TruffleHog", icon: "🐽", category: "Секреты", color: "#f59e0b" },
  trivy: { label: "Trivy", icon: "🔍", category: "SCA", color: "#06b6d4" },
};

const scoreColor = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function HealthRing({ score }: { score: number }) {
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className={styles.healthWrap}>
      <div className={styles.ringGlow} style={{ "--ring-color": color } as React.CSSProperties} />
      <svg className={styles.healthSvg} viewBox="0 0 130 130" aria-label={`Индекс здоровья: ${score}`}>
        <circle cx="65" cy="65" r={radius} className={styles.ringTrack} strokeWidth={stroke} />
        <circle
          cx="65"
          cy="65"
          r={radius}
          className={styles.ringValue}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className={styles.healthCenter}>
        <div className={styles.healthScore} style={{ color }}>
          {score}
        </div>
        <div className={styles.healthLabel}>ЗДОРОВЬЕ</div>
      </div>
    </div>
  );
}

function SeverityDonut({ items }: { items: SeveritySummaryItem[] }) {
  const radius = 56;
  const stroke = 14;
  const size = 140;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let acc = 0;

  return (
    <div className={styles.severityLayout}>
      <div className={styles.severityDonutWrap}>
        <svg className={styles.severityDonut} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} className={styles.ringTrack} strokeWidth={stroke} />
          {items
            .filter((item) => item.value > 0)
            .map((item) => {
              const pct = total > 0 ? item.value / total : 0;
              const segment = pct * circumference;
              const gap = circumference - segment;
              const offset = -acc * circumference;
              acc += pct;
              return (
                <circle
                  key={item.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${segment} ${gap}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <div className={styles.severityCenter}>
          <div className={styles.monoNumber}>{total}</div>
          <div className={styles.healthLabel}>НАХОДОК</div>
        </div>
      </div>

      <div className={styles.legend}>
        {items.map((item) => (
          <div key={item.label} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: item.color }} />
            <span className={styles.legendLabel}>{item.label}</span>
            <span className={styles.legendValue} style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBars({ open, fixed, fp }: { open: number; fixed: number; fp: number }) {
  const items = [
    { label: "Открытые", value: open, color: "#3b82f6" },
    { label: "Исправлено", value: fixed, color: "#22c55e" },
    { label: "Лож. срабат.", value: fp, color: "#64748b" },
  ];
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={styles.statusBars}>
      {items.map((item) => (
        <div key={item.label} className={styles.statusBarRow}>
          <span className={styles.statusLabel}>{item.label}</span>
          <div className={styles.statusTrack}>
            <div
              className={styles.statusFill}
              style={{
                width: `${(item.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${item.color}, ${item.color}b0)`,
              }}
            />
          </div>
          <span className={styles.statusValue} style={{ color: item.value > 0 ? item.color : "#334155" }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product, loading, error } = useProductDetail(id);

  const [sbomTab, setSbomTab] = useState<SbomTab>("sbom");
  const [latestSbom, setLatestSbom] = useState<SbomItem | null>(null);

  useEffect(() => {
    if (!id) return;
    listSboms(id)
      .then((items) => {
        const sorted = [...items].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
        setLatestSbom(sorted[0] ?? null);
      })
      .catch(() => setLatestSbom(null));
  }, [id]);

  const healthScore = useMemo(
    () => (product ? calculateHealthScore(product.severityBreakdown) : 0),
    [product],
  );

  if (!id) {
    return <div className={styles.error}>Некорректный идентификатор продукта.</div>;
  }

  if (loading) {
    return <div className={styles.loading}>Загрузка данных продукта…</div>;
  }

  if (error || !product) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.error}>{error || "Продукт не найден."}</p>
        <button type="button" className={styles.outlineButton} onClick={() => navigate("/products")}>
          ← Назад к продуктам
        </button>
      </div>
    );
  }

  const severity = product.severityBreakdown || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const severityItems: SeveritySummaryItem[] = [
    { label: "Критич.", value: severity.critical, color: "#a855f7" },
    { label: "Высокий", value: severity.high, color: "#ef4444" },
    { label: "Средний", value: severity.medium, color: "#f59e0b" },
    { label: "Низкий", value: severity.low, color: "#22c55e" },
    { label: "Информ.", value: severity.info, color: "#64748b" },
  ];

  const criticalHighCount = severity.critical + severity.high;
  const productVersion = product.version || "—";
  const findingsOpen = product.findingsOpenCount || 0;
  const fixedCount = product.findingsFixedCount || 0;
  const fpCount = product.findingsFalsePositiveCount || 0;

  return (
    <main className={styles.page}>
      <div className={`${styles.block} ${styles.delay0}`}>
        <button type="button" className={styles.backLink} onClick={() => navigate("/products")}>← Назад к продуктам</button>
      </div>

      <section className={`${styles.hero} ${styles.block} ${styles.delay1}`}>
        <div className={styles.heroLeft}>
          <div className={styles.productIdentity}>
            <div className={styles.avatar}>{initials(product.name)}</div>
            <div>
              <h1 className={styles.title}>{product.name}</h1>
              <div className={styles.metaRow}>
                <span className={styles.idMono}>ID: {product.id}</span>
                <span className={styles.dot}>•</span>
                <span className={styles.versionBadge}>{productVersion}</span>
              </div>
            </div>
          </div>

          <p className={styles.description}>{product.description || "Описание продукта отсутствует."}</p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => navigate({ pathname: "/findings", search: `?productId=${id}` })}
            >
              Просмотр находок ({findingsOpen})
            </button>
            <button type="button" className={styles.outlineButton} onClick={() => navigate("/scans/upload")}>
              Загрузить скан
            </button>
          </div>
        </div>

        <div className={styles.heroRight}>
          <HealthRing score={healthScore} />
        </div>
      </section>

      <section className={`${styles.statsStrip} ${styles.block} ${styles.delay2}`}>
        {[
          { icon: "📅", label: "ПОСЛЕДНИЙ СКАН", value: formatDate(product.lastScanAt), accent: "" },
          { icon: "⊙", label: "ВСЕГО СКАНОВ", value: product.totalScans, accent: "" },
          {
            icon: "⚑",
            label: "ОТКРЫТЫЕ НАХОДКИ",
            value: findingsOpen,
            accent: findingsOpen > 0 ? styles.danger : "",
          },
          { icon: "#", label: "ВЕРСИЯ", value: productVersion, accent: styles.info },
        ].map((item) => (
          <div key={item.label} className={styles.statCell}>
            <span className={styles.statIcon}>{item.icon}</span>
            <div>
              <div className={styles.statLabel}>{item.label}</div>
              <div className={`${styles.statValue} ${item.accent}`}>{item.value}</div>
            </div>
          </div>
        ))}
      </section>

      <section className={`${styles.block} ${styles.delay3}`}>
        <h2 className={styles.sectionHeading}>СОСТОЯНИЕ БЕЗОПАСНОСТИ</h2>
        <div className={styles.postureGrid}>
          {[
            { icon: "⚑", label: "ОТКРЫТЫЕ НАХОДКИ", value: findingsOpen, color: "#f59e0b", alert: findingsOpen > 0 },
            { icon: "▲", label: "КРИТИЧ. / ВЫСОКИЙ", value: criticalHighCount, color: "#ef4444", alert: criticalHighCount > 0 },
            { icon: "✓", label: "ИСПРАВЛЕНО", value: fixedCount, color: "#22c55e", alert: false },
            { icon: "◇", label: "ЛОЖ. СРАБАТЫВАНИЯ", value: fpCount, color: "#64748b", alert: false },
          ].map((card) => (
            <article
              key={card.label}
              className={`${styles.postureCard} ${card.alert ? styles.postureAlert : ""}`}
              style={{ "--accent": card.color } as React.CSSProperties}
            >
              <div className={styles.postureIcon}>{card.icon}</div>
              <div>
                <div className={styles.postureLabel}>{card.label}</div>
                <div className={styles.postureValue}>{card.value}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.chartsGrid} ${styles.block} ${styles.delay4}`}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <h3>Распределение по критичности</h3>
            <p>Разбивка открытых находок</p>
          </header>
          <div className={styles.panelBody}>
            <SeverityDonut items={severityItems} />
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <h3>Находки по статусу</h3>
            <p>Открытые / Исправлено / Лож. срабатывания</p>
          </header>
          <div className={styles.panelBody}>
            <StatusBars open={findingsOpen} fixed={fixedCount} fp={fpCount} />
          </div>
        </article>
      </section>

      <section className={`${styles.panel} ${styles.block} ${styles.delay5}`}>
        <header className={styles.panelHeaderInline}>
          <div>
            <h3>Последние сканирования</h3>
            <p>Активность по импорту результатов</p>
          </div>
          <button type="button" className={styles.outlineButton} onClick={() => navigate("/scans/upload")}>
            Загрузить скан
          </button>
        </header>

        <div>
          {(product.recentScans || []).map((scan) => {
            const cfg = TOOL_CONFIG[scan.scanner.toLowerCase()] || {
              label: scan.scanner,
              icon: "◈",
              category: "Сканер",
              color: "#64748b",
            };
            const hasNew = scan.findingsNew > 0;

            return (
              <div key={scan.id} className={styles.scanRow}>
                <div className={styles.scanIcon} style={{ "--scan-color": cfg.color } as React.CSSProperties}>
                  {cfg.icon}
                </div>
                <div className={styles.scanMeta}>
                  <div className={styles.scanTop}>
                    <span className={styles.scanName}>{cfg.label}</span>
                    <span className={styles.scanBadge} style={{ "--scan-color": cfg.color } as React.CSSProperties}>
                      {cfg.category}
                    </span>
                  </div>
                  <span className={styles.scanDate}>{formatDateTime(scan.createdAt)}</span>
                </div>
                <span className={`${styles.scanResult} ${hasNew ? styles.scanResultNew : ""}`}>
                  {hasNew ? `${scan.findingsNew} нов.` : "Нет новых находок"}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.panelFooter}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => navigate({ pathname: "/runs", search: `?productId=${id}` })}
          >
            Показать все {product.totalScans} сканирования →
          </button>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.block} ${styles.delay6}`}>
        <header className={styles.panelHeader}>
          <h3>SBOM и компоненты</h3>
          <p>Управление SBOM и индексированными компонентами</p>
        </header>

        <div className={styles.tabs}>
          {[
            { id: "sbom" as SbomTab, label: "SBOM", cls: styles.tabBlue },
            { id: "components" as SbomTab, label: "Компоненты", cls: styles.tabPurple },
            { id: "bdu" as SbomTab, label: "БДУ ФСТЭК", cls: styles.tabPink },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${tab.cls} ${sbomTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setSbomTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {sbomTab === "sbom" && (
            <div className={styles.sbomGrid}>
              <div className={styles.sbomCard}>
                <div className={styles.sbomKey}>ФОРМАТ</div>
                <div className={styles.sbomVal}>{latestSbom?.format || "CycloneDX"}</div>
              </div>
              <div className={styles.sbomCard}>
                <div className={styles.sbomKey}>ИНСТРУМЕНТ</div>
                <div className={styles.sbomVal}>{latestSbom?.originalFilename || "Syft"}</div>
              </div>
              <div className={styles.sbomCard}>
                <div className={styles.sbomKey}>КОМПОНЕНТЫ</div>
                <div className={styles.sbomVal}>{latestSbom?.componentCount ?? "—"}</div>
              </div>
              <div className={styles.sbomCard}>
                <div className={styles.sbomKey}>ДАТА</div>
                <div className={styles.sbomVal}>{formatDate(latestSbom?.createdAt)}</div>
              </div>
            </div>
          )}

          {sbomTab === "components" && <p className={styles.tabPlaceholder}>Компонент вкладки «Компоненты» будет подключён отдельно.</p>}
          {sbomTab === "bdu" && <p className={styles.tabPlaceholder}>Компонент вкладки «БДУ ФСТЭК» будет подключён отдельно.</p>}
        </div>
      </section>
    </main>
  );
};

export default ProductDetailPage;
