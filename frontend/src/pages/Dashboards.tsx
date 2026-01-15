const Dashboards = () => {
  return (
    <section>
      <h1>Dashboards</h1>
      <p>Метрики SLA, тренды и аналитика из ClickHouse.</p>
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
          <h3>Open Findings</h3>
          <strong>12,480</strong>
        </div>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
          <h3>SLA Breaches</h3>
          <strong>128</strong>
        </div>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
          <h3>Mean Triage Time</h3>
          <strong>4h 12m</strong>
        </div>
      </div>
    </section>
  );
};

export default Dashboards;
