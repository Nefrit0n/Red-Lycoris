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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <aside
        style={{
          width: "220px",
          background: "#0f172a",
          color: "white",
          padding: "24px",
        }}
      >
        <h2 style={{ marginBottom: "24px" }}>ASOC</h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                color: isActive ? "#38bdf8" : "#e2e8f0",
                textDecoration: "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "32px", background: "#f8fafc" }}>{children}</main>
    </div>
  );
};

export default AppLayout;
