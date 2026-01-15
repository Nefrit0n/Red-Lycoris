import { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboards" },
  { to: "/products", label: "Products" },
  { to: "/findings", label: "Findings" },
  { to: "/filters", label: "Filters" },
];

type Props = {
  children: ReactNode;
};

const AppLayout = ({ children }: Props) => {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-badge">LW</div>
          <div>
            <p className="brand-title">Lotus Warden</p>
            <span className="brand-subtitle">Application Security Control</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
            >
              <span className="nav-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <p className="sidebar-card__title">Risk Pulse</p>
          <p className="sidebar-card__value">72%</p>
          <p className="sidebar-card__caption">Improving over last 14 days</p>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-header">
          <div>
            <p className="header-title">Security Operations</p>
            <p className="header-subtitle">Unified visibility across findings, products, and filters.</p>
          </div>
          <div className="header-actions">
            <label className="search-input">
              <span>Search</span>
              <input type="text" placeholder="Findings, product, owner..." />
            </label>
            <button className="primary-button" type="button">
              Create Report
            </button>
            <div className="profile-chip">
              <div className="profile-avatar">AR</div>
              <div>
                <p className="profile-name">Alex Rivera</p>
                <span className="profile-role">AppSec Lead</span>
              </div>
            </div>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
