const Dashboards = () => {
  return (
    <section className="app-section">
      <div>
        <h1 className="page-title">Dashboards</h1>
        <p className="page-subtitle">Метрики SLA, тренды и аналитика из ClickHouse.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Open Findings</span>
          <span className="metric-value">12,480</span>
          <span className="metric-trend">+4.3% week over week</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">SLA Breaches</span>
          <span className="metric-value">128</span>
          <span className="metric-trend">-12% since last report</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Mean Triage Time</span>
          <span className="metric-value">4h 12m</span>
          <span className="metric-trend">Target 6h, on track</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Coverage</span>
          <span className="metric-value">92%</span>
          <span className="metric-trend">+7 integrations added</span>
        </div>
      </div>

      <div className="flex-row">
        <div className="card" style={{ flex: "1 1 380px" }}>
          <div className="card-header">
            <div>
              <p className="card-title">Risk Pipeline</p>
              <p className="card-subtitle">Status of findings in triage</p>
            </div>
            <span className="status-pill status-open">High Priority</span>
          </div>
          <div className="insight-grid">
            <div className="insight-card">
              <h3>Critical findings</h3>
              <p>47 open across 6 products</p>
            </div>
            <div className="insight-card">
              <h3>Auto-remediation</h3>
              <p>36% of issues fixed by playbooks</p>
            </div>
            <div className="insight-card">
              <h3>Ownership health</h3>
              <p>88% assigned to engineering leaders</p>
            </div>
          </div>
        </div>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <div className="card-header">
            <div>
              <p className="card-title">Activity Feed</p>
              <p className="card-subtitle">Latest AppSec updates</p>
            </div>
          </div>
          <div className="flex-row" style={{ flexDirection: "column", gap: "12px" }}>
            <div>
              <p><strong>New playbook deployed</strong></p>
              <p className="card-subtitle">OWASP Top 10 remediation steps synced.</p>
            </div>
            <div>
              <p><strong>Service onboarding</strong></p>
              <p className="card-subtitle">Payments API enrolled to daily scans.</p>
            </div>
            <div>
              <p><strong>Executive report ready</strong></p>
              <p className="card-subtitle">Quarterly risk review published.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboards;
