const Filters = () => {
  return (
    <section>
      <h1>Filters</h1>
      <p>Конструктор фильтров для поиска и сохранённых запросов.</p>
      <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
        <label htmlFor="severity">Severity</label>
        <select id="severity" style={{ marginLeft: "12px" }}>
          <option>All</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>
    </section>
  );
};

export default Filters;
