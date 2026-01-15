import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

const Findings = () => {
  const findings = useAppStore((state) => state.findings);
  const setFindings = useAppStore((state) => state.setFindings);

  useEffect(() => {
    setFindings([
      { id: "f-1", title: "SQL Injection", severity: "high", status: "open" },
      { id: "f-2", title: "Outdated Library", severity: "medium", status: "triage" },
      { id: "f-3", title: "Secrets in CI Logs", severity: "critical", status: "open" },
      { id: "f-4", title: "Missing CSP Header", severity: "low", status: "resolved" },
    ]);
  }, [setFindings]);

  return (
    <section className="app-section">
      <div>
        <h1 className="page-title">Findings</h1>
        <p className="page-subtitle">Сводка нормализованных находок и актуальных SLA.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Critical & High</span>
          <span className="metric-value">289</span>
          <span className="metric-trend">42 require immediate action</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">In Triage</span>
          <span className="metric-value">1,182</span>
          <span className="metric-trend">Median SLA 3h 20m</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Remediated</span>
          <span className="metric-value">7,412</span>
          <span className="metric-trend">+18% month to date</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Normalized Findings</p>
            <p className="card-subtitle">Видимость по всем интеграциям и сигналам.</p>
          </div>
          <span className="status-pill status-triage">SLA: 6 hours</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.title}</td>
                <td>
                  <span className={`badge badge-${finding.severity}`}>
                    {finding.severity.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-pill status-${
                      finding.status === "open"
                        ? "open"
                        : finding.status === "triage"
                        ? "triage"
                        : "resolved"
                    }`}
                  >
                    {finding.status}
                  </span>
                </td>
                <td>Platform Security</td>
                <td>2h ago</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default Findings;
