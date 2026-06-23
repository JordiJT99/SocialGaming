import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  CircleDollarSign,
  Coins,
  Flame,
  Gamepad2,
  Gift,
  Goal,
  Home,
  Menu,
  PlayCircle,
  Radio,
  Search,
  Smile,
  Swords,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";

const CORE_NAV = [
  { path: "/", label: "Inicio", shortLabel: "Home", icon: Home, end: true },
  { path: "/events", label: "Eventos", shortLabel: "Eventos", icon: Trophy },
  { path: "/fantasy", label: "Fantasy", shortLabel: "Fantasy", icon: Goal },
  { path: "/leagues", label: "Ligas", shortLabel: "Ligas", icon: Users },
  { path: "/profile", label: "Perfil", shortLabel: "Perfil", icon: Smile },
];

const SPORT_FILTERS = [
  { key: "football", label: "Fútbol", color: "#22c55e" },
  { key: "basketball", label: "Baloncesto", color: "#f97316" },
  { key: "tennis", label: "Tenis", color: "#eab308" },
  { key: "esports", label: "e-Sports", color: "#a855f7" },
  { key: "other", label: "Otros", color: "#3b82f6" },
];

const SIDE_NAV = [
  { path: "/sportsbook", label: "Quinielas", icon: Trophy, badge: 5 },
  { path: "/challenges", label: "Porras", icon: Swords, badge: 16 },
  { path: "/ranking", label: "Rankings", icon: BarChart3 },
  { path: "/fantasy", label: "Juegos", icon: Gamepad2 },
  { path: "/rewards", label: "Tienda", icon: Gift },
  { path: "/earn", label: "Premios", icon: Trophy },
];

const TITLES = {
  "/": "Tu jornada",
  "/dashboard": "Tu jornada",
  "/predictions": "Predicciones",
  "/live": "En directo",
  "/fantasy": "Fantasy",
  "/leagues": "Ligas privadas",
  "/leagues/": "Detalle de liga",
  "/sportsbook": "Cuotas y mercados",
  "/ranking": "Ranking global",
  "/challenges": "Desafíos",
  "/earn": "Centro de recompensas",
  "/events": "Eventos",
  "/rewards": "Tienda",
  "/profile": "Perfil",
};

function UserAvatar({ user, compact = false }) {
  return <span className={`apex-user-monogram ${compact ? "compact" : ""}`}>{user?.username?.slice(0, 2).toUpperCase() || "JO"}</span>;
}

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.path} end={item.end} onClick={onClick} className={({ isActive }) => isActive ? "active" : ""}>
      <Icon size={20} strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AppHeader({ user, store }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);
  const { pathname } = useLocation();
  const isPredict = pathname === "/predictions" || pathname === "/live";
  const isHome = pathname === "/" || pathname === "/dashboard";
  const title = TITLES[pathname] || (pathname.startsWith("/leagues/") ? "Detalle de liga" : "PROPHET");
  const showLowCoins = !dismissBanner && user?.points != null && user.points < 2000;

  const pendingCoins = (store?.predictions || [])
    .filter((p) => p.userId === "current_user" && ["pending", "pending_quote", "needs_confirmation"].includes(p.status))
    .reduce((sum, p) => sum + (p.pointsBet || 0), 0);

  return (
    <>
      <aside className="apex-desktop-sidebar">
        <div className="apex-sidebar-brand">
          <span className="apex-mark">P</span>
          <strong>Playfulbet</strong>
        </div>

        <div className="apex-sidebar-profile">
          <Link to="/profile" className="apex-sidebar-avatar">
            <Smile size={42} strokeWidth={1.5} />
          </Link>
          <div className="apex-sidebar-user">
            <strong>{user?.username || "Jordi"}</strong>
            <div className="apex-sidebar-coins">
              <div className="apex-sidebar-coins-total">
                <Coins size={16} />
                <b>{(user?.points || 0).toLocaleString("es-ES")}</b>
                <span>Coins</span>
              </div>
              <div className="apex-sidebar-coins-pending">
                <b>{pendingCoins.toLocaleString("es-ES")}</b>
                <span>Coins pendientes</span>
              </div>
            </div>
          </div>
        </div>

        <nav>
          {CORE_NAV.map((item) => <NavItem key={item.path} item={item} />)}

          <div className="apex-sidebar-sport-filters">
            {SPORT_FILTERS.map((sport) => (
              <NavLink
                key={sport.key}
                to={`/events?sport=${sport.key}`}
                className="apex-sidebar-sport"
              >
                <span className="apex-sidebar-sport-icon" style={{ background: sport.color }}>
                  {sport.label[0]}
                </span>
                <span className="apex-sidebar-sport-label">{sport.label}</span>
              </NavLink>
            ))}
          </div>

          {SIDE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => isActive ? "active" : ""}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
                {item.badge != null && <em className="apex-sidebar-badge">{item.badge}</em>}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <header className={`apex-topbar ${isPredict ? "predict-header" : ""}`}>
        <div className="apex-mobile-brand">
          <UserAvatar user={user} compact />
          <strong>PROPHET</strong>
        </div>
        <div className="apex-desktop-heading"><strong>{title}</strong><span>Deporte, predicciones y competición social</span></div>
        <div className="apex-top-actions">
          <button className="apex-search-button desktop-only" type="button" aria-label="Buscar"><Search size={20} /></button>
          <span className="apex-coins"><CircleDollarSign size={19} /><b>{user?.points?.toLocaleString("es-ES") || "540"}</b><small>Coins</small></span>
          {isHome && <span className="apex-level">LVL 12</span>}
          <NavLink to="/profile" className="apex-profile-link" aria-label="Abrir perfil"><UserAvatar user={user} compact /></NavLink>
          <button className="apex-mobile-menu-button" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
        </div>
      </header>

      {showLowCoins && (
        <>
        <div className="apex-low-coins-banner" style={{
          position: "fixed",
          top: "var(--apex-topbar-h, 64px)",
          left: "var(--apex-sidebar-w, 0px)",
          right: 0,
          zIndex: 99,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          borderBottom: "1px solid rgba(255, 107, 87, 0.3)",
          padding: "0.6rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Flame size={18} style={{ color: "#ff6b57", flexShrink: 0 }} />
            <span style={{ fontSize: "0.85rem", color: "#ffd" }}>
              <strong style={{ color: "#ff6b57" }}>Te quedan {user.points} coins</strong> — ¡consigue más gratis!
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <NavLink to="/earn"
              onClick={() => setDismissBanner(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                padding: "0.3rem 0.75rem", borderRadius: "var(--radius)",
                background: "var(--accent)", color: "#fff",
                fontSize: "0.78rem", fontWeight: 600, textDecoration: "none",
              }}
            >
              <PlayCircle size={14} /> Ver video +15
            </NavLink>
            <NavLink to="/earn"
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                padding: "0.3rem 0.75rem", borderRadius: "var(--radius)",
                border: "1px solid var(--border)", color: "var(--text)",
                fontSize: "0.78rem", textDecoration: "none",
              }}
            >
              <Coins size={14} /> Ganar más
            </NavLink>
            <button type="button" onClick={() => setDismissBanner(true)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="apex-low-coins-spacer" style={{ height: "48px" }} />
        </>
      )}

      <nav className="apex-bottom-nav" aria-label="Navegacion principal">
        {CORE_NAV.map(({ path, shortLabel, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end} className={({ isActive }) => isActive ? "active" : ""}>
            <Icon size={23} strokeWidth={2.2} />
            <span>{shortLabel}</span>
          </NavLink>
        ))}
      </nav>

      {menuOpen && (
        <div className="apex-mobile-drawer">
          <button className="apex-drawer-scrim" type="button" aria-label="Cerrar menu" onClick={() => setMenuOpen(false)} />
          <aside>
            <header><strong>Más secciones</strong><button onClick={() => setMenuOpen(false)} aria-label="Cerrar"><X /></button></header>
            <nav>{SIDE_NAV.map((item) => <NavItem key={item.path} item={item} onClick={() => setMenuOpen(false)} />)}</nav>
            <NavLink className="apex-drawer-play" to="/earn" onClick={() => setMenuOpen(false)}><Coins /> Ganar monedas gratis</NavLink>
          </aside>
        </div>
      )}
    </>
  );
}
