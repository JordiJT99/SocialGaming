import { Link, useLocation } from "react-router-dom";

const NAV = [
  { path: "/", label: "Inicio" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/predictions", label: "Predecir" },
  { path: "/leagues", label: "Ligas" },
  { path: "/ranking", label: "Ranking" },
];

export default function AppHeader({ user }) {
  const loc = useLocation();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="app-logo">
          <span className="brand-mark">P</span>
          <span className="brand-text">Playfulbet</span>
        </Link>

        <nav className="app-nav">
          {NAV.map((n) => (
            <Link
              key={n.path}
              to={n.path}
              className={`nav-link ${loc.pathname === n.path ? "active" : ""}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="header-user">
          {user ? (
            <>
              <span className="user-points">
                <span className="coin-icon" /> {user.points.toLocaleString()}
              </span>
              <Link to="/profile" className="user-avatar-small">
                {user.username[0].toUpperCase()}
              </Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Entrar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
