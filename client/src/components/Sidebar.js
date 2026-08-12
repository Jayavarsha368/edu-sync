import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/goals", label: "My Goals" },
    { to: "/progress", label: "Progress" },
    { to: "/profile", label: "Profile" },
  ];

  return (
    <aside className="es-sidebar">
      <Link to="/dashboard" className="es-sidebar-brand">Edu-Sync</Link>

      <div className="es-sidebar-profile">
        <div className="es-avatar">{user.name?.[0]?.toUpperCase() || "S"}</div>
        <div>
          <div className="es-sidebar-name">{user.name}</div>
          <div className="es-sidebar-email">{user.email}</div>
        </div>
      </div>

      {links.map((link) => (
        <Link key={link.to} to={link.to}
          className={`es-sidebar-link ${location.pathname.startsWith(link.to) ? "active" : ""}`}>
          {link.label}
        </Link>
      ))}

      <button className="es-sidebar-logout" onClick={logout}>Logout</button>
    </aside>
  );
}

export default Sidebar;