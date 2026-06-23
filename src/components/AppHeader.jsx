import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  CircleDollarSign,
  Coins,
  Gamepad2,
  Gift,
  Goal,
  Home,
  Menu,
  Radio,
  Search,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";

const CORE_NAV = [
  { path: "/", label: "Inicio", shortLabel: "Home", icon: Home, end: true },
  { path: "/predictions", label: "Predicciones", shortLabel: "Predict", icon: Target },
  { path: "/fantasy", label: "Fantasy", shortLabel: "Fantasy", icon: Goal },
  { path: "/leagues", label: "Ligas privadas", shortLabel: "Leagues", icon: Users },
  { path: "/profile", label: "Perfil", shortLabel: "Profile", icon: UserRound },
];

const EXPLORE_NAV = [
  { path: "/live", label: "En directo", icon: Radio },
  { path: "/sportsbook", label: "Cuotas y mercados", icon: Radio },
  { path: "/ranking", label: "Ranking global", icon: BarChart3 },
  { path: "/challenges", label: "Desafíos", icon: Swords },
  { path: "/earn", label: "Ganar monedas", icon: Coins },
  { path: "/rewards", label: "Recompensas", icon: Gift },
];

const TITLES = {
  "/": "Tu jornada",
  "/dashboard": "Tu jornada",
  "/predictions": "Predicciones",
  "/live": "En directo",
  "/fantasy": "Fantasy",
  "/leagues": "Ligas privadas",
  "/sportsbook": "Cuotas y mercados",
  "/ranking": "Ranking global",
  "/challenges": "Desafíos",
  "/earn": "Centro de recompensas",
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

export default function AppHeader({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isPredict = pathname === "/predictions" || pathname === "/live";
  const isHome = pathname === "/" || pathname === "/dashboard";
  const title = TITLES[pathname] || (pathname.startsWith("/leagues/") ? "Detalle de liga" : "PROPHET");

  return (
    <>
      <aside className="apex-desktop-sidebar">
        <div className="apex-sidebar-brand"><span className="apex-mark">P</span><strong>PROPHET</strong></div>
        <div className="apex-sidebar-profile"><UserAvatar user={user} /><div><strong>{user?.username || "Jordi"}</strong><span>Nivel 12 · Analista</span></div></div>
        <nav>
          <small>JUGAR</small>
          {CORE_NAV.map((item) => <NavItem key={item.path} item={item} />)}
          <small>DESCUBRIR</small>
          {EXPLORE_NAV.map((item) => <NavItem key={item.path} item={item} />)}
        </nav>
        <section className="apex-sidebar-challenge">
          <Trophy size={21} />
          <span>RETO ACTIVO</span>
          <strong>Acierta 3 pronósticos</strong>
          <i><u /></i>
          <small>2 de 3 completados</small>
        </section>
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
            <nav>{EXPLORE_NAV.map((item) => <NavItem key={item.path} item={item} onClick={() => setMenuOpen(false)} />)}</nav>
            <NavLink className="apex-drawer-play" to="/sportsbook" onClick={() => setMenuOpen(false)}><Gamepad2 /> Abrir mercados en directo</NavLink>
          </aside>
        </div>
      )}
    </>
  );
}
