import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const navItems = [
  { path: "/", label: "仪表盘", icon: "◉" },
  { path: "/devices", label: "设备管理", icon: "⛯" },
  { path: "/alert-rules", label: "告警规则", icon: "⚠" },
  { path: "/history", label: "历史数据", icon: "↻" },
  { path: "/reports", label: "数据报表", icon: "▤" },
  { path: "/audit-logs", label: "审计日志", icon: "☰" },
  { path: "/settings", label: "系统设置", icon: "⚙" },
  { path: "/notifications", label: "通知渠道", icon: "✉" },
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>冷链监控</h2>
          <span className="sidebar-version">v3.0</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.username} ({user?.role})</span>
          <button className="btn-logout" onClick={logout}>退出</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
