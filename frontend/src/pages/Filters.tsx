const Filters = () => {
  return (
    <section className="app-section">
      <div>
        <h1 className="page-title">Filters</h1>
        <p className="page-subtitle">Конструктор фильтров для поиска и сохранённых запросов.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Create Smart Filter</p>
            <p className="card-subtitle">Набор правил для точного поиска сигналов.</p>
          </div>
          <button className="primary-button" type="button">
            Save Filter
          </button>
        </div>
        <div className="filter-grid">
          <div className="input-group">
            <label htmlFor="severity">Severity</label>
            <select id="severity">
              <option>All</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="status">Status</label>
            <select id="status">
              <option>Open</option>
              <option>Triage</option>
              <option>Resolved</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="owner">Owner team</label>
            <input id="owner" placeholder="Platform Security" />
          </div>
          <div className="input-group">
            <label htmlFor="sla">SLA window</label>
            <select id="sla">
              <option>0 - 6 hours</option>
              <option>6 - 12 hours</option>
              <option>12 - 24 hours</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Active Filters</p>
            <p className="card-subtitle">Часто используемые настройки поиска.</p>
          </div>
        </div>
        <div className="flex-row">
          <span className="filter-pill">Critical + High | Open</span>
          <span className="filter-pill">Team: Identity | SLA 6h</span>
          <span className="filter-pill">Unassigned Findings</span>
        </div>
      </div>
    </section>
  );
};

export default Filters;
