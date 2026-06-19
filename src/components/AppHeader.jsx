import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  CircleHelp,
  Gift,
  Home,
  Menu,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

const NAV = [
  { path: "/", label: "Inicio", icon: Home, end: true },
  { path: "/dashboard", label: "Mi panel", icon: BarChart3 },
  { path: "/predictions", label: "Predicciones", icon: Target },
  { path: "/leagues", label: "Mis ligas", icon: Users },
  { path: "/ranking", label: "Clasificacion", icon: Trophy },
];

const SECONDARY_NAV = [
  { label: "Desafios", icon: Swords },
  { label: "Premios", icon: Gift },
];

export default function AppHeader({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <aside className={`side-nav ${menuOpen ? "mobile-open" : ""}`}>
        <Link to="/" className="side-brand" aria-label="Playfulbet" onClick={() => setMenuOpen(false)}>
          <span className="brand-ball">P</span>
          <span>playfulbet</span>
        </Link>

        <div className="side-profile">
          <div className="side-avatar">{user?.username?.[0]?.toUpperCase() || "J"}</div>
          <div>
            <strong>{user?.username || "Jugador"}</strong>
            <span>Nivel 12</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav className="side-links" aria-label="Navegacion principal">
          <span className="side-label">Jugar</span>
          {NAV.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}

          <span className="side-label side-label-spaced">Descubrir</span>
          {SECONDARY_NAV.map(({ label, icon: Icon }) => (
            <button className="side-link" type="button" key={label}>
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
              {label === "Premios" && <small>Nuevo</small>}
            </button>
          ))}
        </nav>

        <div className="side-footer">
          <button type="button"><CircleHelp size={17} /> Ayuda</button>
          <button type="button"><ShieldCheck size={17} /> Juego responsable</button>
        </div>
      </aside>

      <header className="top-bar">
        <button
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={21} />
        </button>
        <div className="top-message">
          <strong>Juega gratis.</strong>
          <span>Demuestra cuanto sabes de deporte.</span>
        </div>
        <div className="top-actions">
          <div className="coin-balance">
            <span className="coin">P</span>
            <strong>{user?.points?.toLocaleString("es-ES") || "2.450"}</strong>
            <span>monedas</span>
          </div>
          <Link to="/profile" className="profile-button" aria-label="Ver perfil">
            <UserRound size={18} />
          </Link>
        </div>
      </header>
      {menuOpen && (
        <button
          className="nav-scrim"
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
