import { useState, useMemo } from "react";

/* ══════════════════════════════════════════
   CycloneDX-aware mock data
   Based on real Syft output for Cassandra
   ══════════════════════════════════════════ */
const components = [
  {
    bomRef: "pkg:maven/AmazonCorrettoCryptoProvider/AmazonCorrettoCryptoProvider@2.2.0-linux-aarch_64?package-id=4177dcc99ada6d72",
    type: "library", group: "", name: "AmazonCorrettoCryptoProvider",
    version: "2.2.0-linux-aarch_64",
    cpe: "cpe:2.3:a:AmazonCorrettoCryptoProvider:AmazonCorrettoCryptoProvider:2.2.0-linux-aarch_64:*:*:*:*:*:*:*",
    purl: "pkg:maven/AmazonCorrettoCryptoProvider/AmazonCorrettoCryptoProvider@2.2.0-linux-aarch_64",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: [],
    hashes: [{ alg: "SHA-1", content: "437bdcdee44ddc513b93202919323bc439c56c3b" }],
    location: "/opt/cassandra/lib/aarch64/AmazonCorrettoCryptoProvider-2.2.0-linux-aarch_64.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 0, dependsOn: [], dependedBy: [],
  },
  {
    bomRef: "pkg:maven/AmazonCorrettoCryptoProvider/AmazonCorrettoCryptoProvider@2.2.0-linux-x86_64?package-id=320ad4844b68fafe",
    type: "library", group: "", name: "AmazonCorrettoCryptoProvider",
    version: "2.2.0-linux-x86_64",
    cpe: "cpe:2.3:a:AmazonCorrettoCryptoProvider:AmazonCorrettoCryptoProvider:2.2.0-linux-x86_64:*:*:*:*:*:*:*",
    purl: "pkg:maven/AmazonCorrettoCryptoProvider/AmazonCorrettoCryptoProvider@2.2.0-linux-x86_64",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: [],
    hashes: [{ alg: "SHA-1", content: "5e1b3fc7afbce477085fad8112dddab467985cd9" }],
    location: "/opt/cassandra/lib/x86_64/AmazonCorrettoCryptoProvider-2.2.0-linux-x86_64.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 0, dependsOn: [], dependedBy: [],
  },
  {
    bomRef: "pkg:maven/org.hdrhistogram/HdrHistogram@2.1.12",
    type: "library", group: "org.hdrhistogram", name: "HdrHistogram",
    version: "2.1.12",
    cpe: "cpe:2.3:a:org.hdrhistogram.HdrHistogram:HdrHistogram:2.1.12:*:*:*:*:*:*:*",
    purl: "pkg:maven/org.hdrhistogram/HdrHistogram@2.1.12",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["CC0-1.0", "BSD-2-Clause"],
    hashes: [{ alg: "SHA-1", content: "6eb7552156e0d517ae80cc2247be1427c8d90452" }],
    location: "/opt/cassandra/lib/HdrHistogram-2.1.12.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 0, dependsOn: [], dependedBy: ["cassandra-all"],
  },
  {
    bomRef: "pkg:deb/ubuntu/adduser@3.118ubuntu5",
    type: "library", group: "", name: "adduser",
    version: "3.118ubuntu5",
    cpe: "cpe:2.3:a:adduser:adduser:3.118ubuntu5:*:*:*:*:*:*:*",
    purl: "pkg:deb/ubuntu/adduser@3.118ubuntu5?arch=all&distro=ubuntu-22.04",
    ecosystem: "deb", language: "", packageType: "deb",
    foundBy: "dpkg-db-cataloger",
    licenses: ["GPL-2.0-only"],
    hashes: [],
    location: "/var/lib/dpkg/info/adduser.list",
    layerId: "sha256:b237fe9…a01c",
    vulns: 0,
    dependsOn: ["debconf", "passwd"],
    dependedBy: ["apt"],
  },
  {
    bomRef: "pkg:deb/ubuntu/apt@2.4.13",
    type: "application", group: "", name: "apt",
    version: "2.4.13",
    cpe: "cpe:2.3:a:apt:apt:2.4.13:*:*:*:*:*:*:*",
    purl: "pkg:deb/ubuntu/apt@2.4.13?arch=amd64&distro=ubuntu-22.04",
    ecosystem: "deb", language: "", packageType: "deb",
    foundBy: "dpkg-db-cataloger",
    licenses: ["GPL-2.0-only"],
    hashes: [],
    location: "/var/lib/dpkg/info/apt.list",
    layerId: "sha256:b237fe9…a01c",
    vulns: 0,
    dependsOn: ["adduser", "gpgv", "libapt-pkg6.0", "libc6", "libgcc-s1", "libgnutls30", "libseccomp2", "libstdc++6", "libsystemd0", "ubuntu-keyring"],
    dependedBy: [],
  },
  {
    bomRef: "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.4",
    type: "library", group: "com.fasterxml.jackson.core", name: "jackson-databind",
    version: "2.13.4",
    cpe: "cpe:2.3:a:fasterxml:jackson-databind:2.13.4:*:*:*:*:*:*:*",
    purl: "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.4",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "998e01a4ea2fbbbed9e4a0b23a8e4e3c0df3249d" }],
    location: "/opt/cassandra/lib/jackson-databind-2.13.4.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 3,
    dependsOn: ["jackson-core", "jackson-annotations"],
    dependedBy: ["cassandra-all", "cassandra-driver-core"],
  },
  {
    bomRef: "pkg:maven/org.springframework/spring-core@5.3.23",
    type: "framework", group: "org.springframework", name: "spring-core",
    version: "5.3.23",
    cpe: "cpe:2.3:a:springframework:spring-core:5.3.23:*:*:*:*:*:*:*",
    purl: "pkg:maven/org.springframework/spring-core@5.3.23",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "a1b2c3d4e5f60718293a4b5c6d7e8f90" }],
    location: "/opt/cassandra/lib/spring-core-5.3.23.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 1,
    dependsOn: ["spring-jcl"],
    dependedBy: ["spring-beans", "spring-context"],
  },
  {
    bomRef: "pkg:maven/io.netty/netty-all@4.1.82.Final",
    type: "library", group: "io.netty", name: "netty-all",
    version: "4.1.82.Final",
    cpe: "cpe:2.3:a:netty:netty-all:4.1.82.Final:*:*:*:*:*:*:*",
    purl: "pkg:maven/io.netty/netty-all@4.1.82.Final",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "0011aabb2233ccdd4455eeff6677" }],
    location: "/opt/cassandra/lib/netty-all-4.1.82.Final.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 5,
    dependsOn: ["netty-buffer", "netty-codec", "netty-common", "netty-handler", "netty-transport"],
    dependedBy: ["cassandra-all"],
  },
  {
    bomRef: "pkg:maven/org.apache.logging.log4j/log4j-core@2.17.0",
    type: "library", group: "org.apache.logging.log4j", name: "log4j-core",
    version: "2.17.0",
    cpe: "cpe:2.3:a:apache:log4j-core:2.17.0:*:*:*:*:*:*:*",
    purl: "pkg:maven/org.apache.logging.log4j/log4j-core@2.17.0",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "aabbccdd00112233eeff4455" }],
    location: "/opt/cassandra/lib/log4j-core-2.17.0.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 0,
    dependsOn: ["log4j-api"],
    dependedBy: ["cassandra-all"],
  },
  {
    bomRef: "pkg:maven/com.google.guava/guava@31.1-jre",
    type: "library", group: "com.google.guava", name: "guava",
    version: "31.1-jre",
    cpe: "cpe:2.3:a:google:guava:31.1-jre:*:*:*:*:*:*:*",
    purl: "pkg:maven/com.google.guava/guava@31.1-jre",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "112233aabb4455ccddee" }],
    location: "/opt/cassandra/lib/guava-31.1-jre.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 2,
    dependsOn: ["failureaccess", "listenablefuture", "jsr305", "checker-qual", "error_prone_annotations"],
    dependedBy: ["cassandra-all"],
  },
  {
    bomRef: "pkg:maven/net.openhft/affinity@3.23.3",
    type: "library", group: "net.openhft", name: "affinity",
    version: "3.23.3",
    cpe: "cpe:2.3:a:openhft:affinity:3.23.3:*:*:*:*:*:*:*",
    purl: "pkg:maven/net.openhft/affinity@3.23.3",
    ecosystem: "maven", language: "java", packageType: "java-archive",
    foundBy: "java-archive-cataloger",
    licenses: ["Apache-2.0"],
    hashes: [{ alg: "SHA-1", content: "ff00ee11dd22cc33" }],
    location: "/opt/cassandra/lib/affinity-3.23.3.jar",
    layerId: "sha256:472d0243d…40d4",
    vulns: 0, dependsOn: [], dependedBy: ["cassandra-all"],
  },
];

/* ══════════════════════════════════════════
   Config
   ══════════════════════════════════════════ */
const ECO = {
  maven: { color: "#f97316", bg: "#431407", icon: "M", label: "Maven" },
  npm:   { color: "#ef4444", bg: "#450a0a", icon: "N", label: "npm" },
  pypi:  { color: "#3b82f6", bg: "#172554", icon: "P", label: "PyPI" },
  deb:   { color: "#a855f7", bg: "#3b0764", icon: "D", label: "Deb" },
  go:    { color: "#06b6d4", bg: "#083344", icon: "G", label: "Go" },
  other: { color: "#64748b", bg: "#1e293b", icon: "?", label: "Other" },
};

const TYPE_CFG = {
  library:     { label: "lib",  color: "#60a5fa" },
  framework:   { label: "frm",  color: "#a78bfa" },
  application: { label: "app",  color: "#34d399" },
  container:   { label: "ctr",  color: "#f472b6" },
  firmware:    { label: "fw",   color: "#fbbf24" },
  file:        { label: "file", color: "#94a3b8" },
  os:          { label: "os",   color: "#fb923c" },
};

const LIC_COL = {
  "Apache-2.0": "#22c55e", "MIT": "#3b82f6", "BSD-2-Clause": "#06b6d4", "BSD-3-Clause": "#06b6d4",
  "GPL-2.0-only": "#f59e0b", "GPL-3.0-only": "#f97316", "CC0-1.0": "#94a3b8", "ISC": "#34d399",
};
function licCol(l) {
  for (const [k, c] of Object.entries(LIC_COL)) { if (l.toLowerCase().includes(k.toLowerCase())) return c; }
  return "#64748b";
}

/* ══════════════════════════════════════════
   Micro Components
   ══════════════════════════════════════════ */
function EcoBadge({ eco }) {
  const c = ECO[eco] || ECO.other;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 6px 2px 3px", borderRadius: 5,
      background: c.bg, border: `1px solid ${c.color}22`,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: c.color + "20", color: c.color,
        fontSize: 9, fontWeight: 800, fontFamily: "var(--mono)",
      }}>{c.icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: c.color }}>{c.label}</span>
    </span>
  );
}

function TypeBadge({ type }) {
  const t = TYPE_CFG[type] || { label: "?", color: "#64748b" };
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
      color: t.color, background: t.color + "15", letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}>{t.label}</span>
  );
}

function VulnBadge({ count }) {
  if (!count) return <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#1e293b", fontWeight: 600 }}>0</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 20, height: 18, borderRadius: 4, padding: "0 5px",
      fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
      color: "#fca5a5", background: "#450a0a", border: "1px solid #dc262640",
      boxShadow: "0 0 6px #dc262618",
    }}>{count}</span>
  );
}

function DepCount({ deps, reverse }) {
  const n = deps.length;
  if (!n) return <span style={{ fontSize: 10, color: "#1e293b" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontFamily: "var(--mono)", fontWeight: 600,
      color: reverse ? "#c084fc" : "#60a5fa",
    }}>
      <span style={{ fontSize: 8, opacity: 0.6 }}>{reverse ? "◂" : "▸"}</span>{n}
    </span>
  );
}

function LicTags({ licenses }) {
  if (!licenses?.length) return <span style={{ fontSize: 10, color: "#1e293b" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {licenses.map((l, i) => {
        const c = licCol(l);
        return (
          <span key={i} style={{
            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3,
            color: c, background: c + "14", border: `1px solid ${c}18`,
            whiteSpace: "nowrap",
          }}>{l}</span>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   Expanded Detail — tabbed with CycloneDX fields
   ══════════════════════════════════════════ */
const DETAIL_TABS = {
  identity:  { label: "Идентификация", accent: "#60a5fa", bg: "#0c1a2e" },
  deps:      { label: "Зависимости",   accent: "#c084fc", bg: "#150e2e" },
  location:  { label: "Расположение",  accent: "#34d399", bg: "#0a1f17" },
  hashes:    { label: "Хеши",          accent: "#f59e0b", bg: "#1a1508" },
};

function ExpandedDetail({ comp }) {
  const [tab, setTab] = useState("identity");
  const t = DETAIL_TABS[tab];

  return (
    <div style={{ borderTop: "1px solid #1e293b50", animation: "fadeSlide 0.2s ease" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, background: "#080c16",
        borderBottom: `1px solid ${t.accent}18`, padding: "0 12px 0 52px",
        transition: "border-color 0.3s",
      }}>
        {Object.entries(DETAIL_TABS).map(([k, cfg]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={e => { e.stopPropagation(); setTab(k); }} style={{
              padding: "8px 12px", fontSize: 10, fontWeight: 600,
              fontFamily: "var(--body)",
              color: active ? cfg.accent : "#2d3548",
              background: active ? cfg.accent + "10" : "transparent",
              border: "none",
              borderBottom: active ? `2px solid ${cfg.accent}` : "2px solid transparent",
              borderRadius: active ? "4px 4px 0 0" : 0,
              cursor: "pointer", transition: "all 0.15s",
              letterSpacing: "0.04em",
            }}>{cfg.label}</button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{
        background: `linear-gradient(180deg, ${t.bg} 0%, #080d19 100%)`,
        padding: "14px 18px 14px 64px",
        transition: "background 0.35s",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 52, right: 0, height: 1,
          background: `linear-gradient(90deg, ${t.accent}40, transparent 60%)`,
          transition: "background 0.35s",
        }} />

        <div onClick={e => e.stopPropagation()}>
          {/* ── Identity ── */}
          {tab === "identity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="PURL" value={comp.purl} mono wide />
              <Field label="CPE" value={comp.cpe} mono wide />
              <Field label="bom-ref" value={comp.bomRef} mono wide tiny />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
                <Field label="Group" value={comp.group || "—"} mono />
                <Field label="Type" badge={<TypeBadge type={comp.type} />} value={comp.type} />
                <Field label="Language" value={comp.language || "—"} />
                <Field label="Package Type" value={comp.packageType} mono />
                <Field label="Found By" value={comp.foundBy} />
              </div>
            </div>
          )}

          {/* ── Dependencies ── */}
          {tab === "deps" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "#60a5fa80",
                  letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 10 }}>▸</span> DEPENDS ON ({comp.dependsOn.length})
                </div>
                {comp.dependsOn.length === 0 && <EmptyState text="Нет зависимостей" />}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {comp.dependsOn.map((d, i) => <DepPill key={i} name={d} color="#60a5fa" />)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "#c084fc80",
                  letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 10 }}>◂</span> DEPENDED BY ({comp.dependedBy.length})
                </div>
                {comp.dependedBy.length === 0 && <EmptyState text="Нет зависимых" />}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {comp.dependedBy.map((d, i) => <DepPill key={i} name={d} color="#c084fc" />)}
                </div>
              </div>
            </div>
          )}

          {/* ── Location ── */}
          {tab === "location" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Path" value={comp.location} mono wide icon="📁" />
              <Field label="Layer ID" value={comp.layerId} mono wide tiny icon="🐳" />
            </div>
          )}

          {/* ── Hashes ── */}
          {tab === "hashes" && (
            <div>
              {comp.hashes.length === 0 && <EmptyState text="Хеши отсутствуют в SBOM" />}
              {comp.hashes.map((h, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", background: "#0c1220",
                  borderRadius: 6, border: "1px solid #1e293b30",
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                    background: "#f59e0b14", color: "#f59e0b", letterSpacing: "0.06em",
                  }}>{h.alg}</span>
                  <span style={{
                    fontSize: 11, fontFamily: "var(--mono)", color: "#94a3b8",
                    wordBreak: "break-all",
                  }}>{h.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono, wide, tiny, badge, icon }) {
  return (
    <div style={{ ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "#2d3548",
        letterSpacing: "0.08em", marginBottom: 3,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
        {label}
        {badge && <span style={{ marginLeft: 6 }}>{badge}</span>}
      </div>
      <div style={{
        padding: "6px 10px", borderRadius: 4,
        background: "#080d19", border: "1px solid #1e293b30",
        fontSize: tiny ? 10 : 11.5,
        fontFamily: mono ? "var(--mono)" : "var(--body)",
        color: "#94a3b8", wordBreak: "break-all", lineHeight: 1.5,
      }}>{value}</div>
    </div>
  );
}

function DepPill({ name, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 5,
      background: color + "08", border: `1px solid ${color}15`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: color, opacity: 0.5,
      }} />
      <span style={{
        fontSize: 11, fontFamily: "var(--mono)",
        color: color, fontWeight: 500, opacity: 0.8,
      }}>{name}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: "14px 0", textAlign: "center",
      fontSize: 11, color: "#1e293b", fontStyle: "italic",
    }}>{text}</div>
  );
}

/* ══════════════════════════════════════════
   Stats
   ══════════════════════════════════════════ */
function StatsBar({ data }) {
  const total = data.length;
  const withVulns = data.filter(c => c.vulns > 0).length;
  const totalVulns = data.reduce((s, c) => s + c.vulns, 0);
  const ecosystems = [...new Set(data.map(c => c.ecosystem))];
  const languages = [...new Set(data.map(c => c.language).filter(Boolean))];

  return (
    <div style={{
      display: "flex", gap: 0, borderRadius: 8, overflow: "hidden",
      border: "1px solid #1e293b", marginBottom: 14,
    }}>
      <Stat label="Компонентов" value={total} color="#e2e8f0" />
      <Stat label="С уязвимостями" value={withVulns} color={withVulns ? "#fca5a5" : "#334155"} alert={withVulns > 0} />
      <Stat label="Уязвимостей" value={totalVulns} color={totalVulns ? "#f87171" : "#334155"} alert={totalVulns > 0} />
      <div style={{
        flex: 1, padding: "8px 14px", background: "#0c1220",
        borderLeft: "1px solid #1e293b30",
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em" }}>ЭКОСИСТЕМЫ</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {ecosystems.map(e => <EcoBadge key={e} eco={e} />)}
        </div>
      </div>
      <div style={{
        padding: "8px 14px", background: "#0c1220",
        borderLeft: "1px solid #1e293b30",
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em" }}>ЯЗЫКИ</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {languages.map(l => (
            <span key={l} style={{
              fontSize: 10, fontWeight: 600, padding: "2px 7px",
              borderRadius: 4, background: "#172554", color: "#60a5fa",
              border: "1px solid #1e3a5f30",
            }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, alert }) {
  return (
    <div style={{
      padding: "8px 18px", background: alert ? "#450a0a18" : "#0c1220",
      borderRight: "1px solid #1e293b30",
      display: "flex", flexDirection: "column", gap: 1, minWidth: 90,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--mono)", color, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main
   ══════════════════════════════════════════ */
export default function ComponentsList() {
  const [search, setSearch] = useState("");
  const [ecoFilter, setEcoFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const allEcos = useMemo(() => [...new Set(components.map(c => c.ecosystem))], []);

  const filtered = useMemo(() => {
    let r = components.filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (![c.name, c.purl, c.group, c.version, c.cpe].some(f => f.toLowerCase().includes(q))) return false;
      }
      if (ecoFilter !== "all" && c.ecosystem !== ecoFilter) return false;
      if (scopeFilter === "vulns" && c.vulns === 0) return false;
      return true;
    });
    r.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "version") cmp = a.version.localeCompare(b.version);
      else if (sortBy === "vulns") cmp = a.vulns - b.vulns;
      else if (sortBy === "ecosystem") cmp = a.ecosystem.localeCompare(b.ecosystem);
      else if (sortBy === "deps") cmp = a.dependsOn.length - b.dependsOn.length;
      return cmp * sortDir;
    });
    return r;
  }, [search, ecoFilter, scopeFilter, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d * -1);
    else { setSortBy(col); setSortDir(1); }
  }
  function SortArr({ col }) {
    const a = sortBy === col;
    return (
      <svg width="8" height="10" viewBox="0 0 8 10" style={{ marginLeft: 2, opacity: a ? 1 : 0.2, flexShrink: 0 }}>
        <path d="M4 0l3 4H1z" fill={a && sortDir === 1 ? "#60a5fa" : "#475569"} />
        <path d="M4 10l3-4H1z" fill={a && sortDir === -1 ? "#60a5fa" : "#475569"} />
      </svg>
    );
  }

  const CH = { padding: "8px 8px", fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, userSelect: "none" };

  return (
    <div style={{ fontFamily: "var(--body)", background: "#080d19", color: "#e2e8f0", minHeight: "100vh", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root { --body: 'IBM Plex Sans', -apple-system, sans-serif; --mono: 'JetBrains Mono', 'Fira Code', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e293b; border-radius:3px; }
      `}</style>

      <StatsBar data={filtered} />

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#0c1220", borderRadius: 6, border: "1px solid #1e293b",
          padding: "6px 12px", flex: "0 1 280px",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2d3548" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setExpandedIdx(null); }}
            placeholder="name, group, purl, cpe..."
            style={{ background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 12, fontFamily: "var(--body)", width: "100%" }}
          />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", fontSize: 14, padding: 0 }}>×</button>}
        </div>

        <div style={{ display: "flex", gap: 3 }}>
          <Pill active={ecoFilter === "all"} onClick={() => setEcoFilter("all")}>Все</Pill>
          {allEcos.map(e => { const ec = ECO[e] || ECO.other; return <Pill key={e} active={ecoFilter === e} color={ec.color} onClick={() => setEcoFilter(e)}>{ec.label}</Pill>; })}
        </div>

        <div style={{ width: 1, height: 18, background: "#1e293b" }} />

        <div style={{ display: "flex", gap: 3 }}>
          <Pill active={scopeFilter === "all"} onClick={() => setScopeFilter("all")}>Все</Pill>
          <Pill active={scopeFilter === "vulns"} color="#f87171" onClick={() => setScopeFilter(scopeFilter === "vulns" ? "all" : "vulns")}>С уязвимостями</Pill>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr 120px 62px 42px 42px 42px 120px",
          background: "#0a0e18", borderBottom: "1px solid #1e293b", padding: 0,
        }}>
          <div />
          <div style={CH} onClick={() => toggleSort("name")}>Компонент <SortArr col="name" /></div>
          <div style={CH} onClick={() => toggleSort("version")}>Версия <SortArr col="version" /></div>
          <div style={{ ...CH, justifyContent: "center" }} onClick={() => toggleSort("ecosystem")}>Экосист. <SortArr col="ecosystem" /></div>
          <div style={{ ...CH, justifyContent: "center" }}>Vulns</div>
          <div style={{ ...CH, justifyContent: "center", fontSize: 8 }} onClick={() => toggleSort("deps")}>Deps <SortArr col="deps" /></div>
          <div style={{ ...CH, justifyContent: "center", fontSize: 8 }}>Used</div>
          <div style={CH}>Лицензия</div>
        </div>

        {/* Rows */}
        {filtered.map((c, i) => {
          const open = expandedIdx === i;
          const hot = c.vulns > 0;
          return (
            <div key={i}>
              <div
                onClick={() => setExpandedIdx(open ? null : i)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 120px 62px 42px 42px 42px 120px",
                  alignItems: "center", minHeight: 42,
                  background: open ? "#111827" : hot ? "#0e0a0a" : "#0c1220",
                  borderBottom: open ? "none" : "1px solid #1e293b18",
                  borderLeft: hot ? "2px solid #dc262630" : "2px solid transparent",
                  cursor: "pointer", transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (!open) e.currentTarget.style.background = "#0f172a"; }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.background = hot ? "#0e0a0a" : "#0c1220"; }}
              >
                {/* Chevron */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s", opacity: 0.25 }}>
                    <path d="M2 0l5 4-5 4z" fill="#94a3b8" />
                  </svg>
                </div>

                {/* Name */}
                <div style={{ padding: "6px 8px 6px 0", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TypeBadge type={c.type} />
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: "#e2e8f0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{c.name}</span>
                  </div>
                  {c.group && (
                    <div style={{
                      fontSize: 9.5, color: "#2d3548", fontFamily: "var(--mono)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1, paddingLeft: 30,
                    }}>{c.group}</div>
                  )}
                </div>

                {/* Version */}
                <div style={{
                  fontSize: 11, fontFamily: "var(--mono)", color: "#64748b", fontWeight: 500,
                  padding: "0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{c.version}</div>

                {/* Ecosystem */}
                <div style={{ display: "flex", justifyContent: "center" }}><EcoBadge eco={c.ecosystem} /></div>

                {/* Vulns */}
                <div style={{ display: "flex", justifyContent: "center" }}><VulnBadge count={c.vulns} /></div>

                {/* Deps */}
                <div style={{ display: "flex", justifyContent: "center" }}><DepCount deps={c.dependsOn} /></div>

                {/* Used by */}
                <div style={{ display: "flex", justifyContent: "center" }}><DepCount deps={c.dependedBy} reverse /></div>

                {/* License */}
                <div style={{ padding: "0 8px" }}><LicTags licenses={c.licenses} /></div>
              </div>

              {open && <ExpandedDetail comp={c} />}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#1e293b", fontSize: 13 }}>Компоненты не найдены</div>
        )}
      </div>

      <div style={{ padding: "8px 0", textAlign: "right", fontSize: 10, color: "#1e293b" }}>
        {filtered.length} из {components.length}
      </div>
    </div>
  );
}

function Pill({ children, active, color = "#64748b", onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 9px", borderRadius: 5, fontSize: 10, fontWeight: 600,
      fontFamily: "var(--body)",
      color: active ? (color === "#64748b" ? "#e2e8f0" : color) : "#2d3548",
      background: active ? (color === "#64748b" ? "#1e293b" : color + "15") : "transparent",
      border: `1px solid ${active ? (color === "#64748b" ? "#334155" : color + "25") : "#1e293b30"}`,
      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}
