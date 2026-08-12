import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="es-navbar">
      <Link className="es-brand" to="/dashboard">Edu-Sync</Link>

      {user && (
        <div className="es-nav-links">
          <Link to="/studyplan">Study Plan</Link>
          <Link to="/goalsetup">Goal Setup</Link>
          <Link to="/progress">Progress</Link>
          <Link to="/profile" className="es-nav-profile">{user.name}</Link>
          <button className="es-btn-logout" onClick={logout}>Logout</button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;