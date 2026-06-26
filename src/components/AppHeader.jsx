import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Coins,
  Flame,
  Gamepad2,
  Gift,
  Goal,
  Home,
  Menu,
  Pencil,
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
  "/sportsbook": "Quinielas",
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

export default function AppHeader({ user, store, sportsData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);
  const { pathname, search } = useLocation();
  const isPredict = pathname === "/predictions" || pathname === "/live";
  const isHome = pathname === "/" || pathname === "/dashboard";
  const title = TITLES[pathname] || (pathname.startsWith("/leagues/") ? "Detalle de liga" : "PROPHET");
  const showLowCoins = !dismissBanner && user?.points != null && user.points < 2000;
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const searchResults = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q || !sportsData?.matches) return [];
    const matches = sportsData.matches.filter((match) => {
      const haystack = [match.home, match.away, match.league, match.sportName].filter(Boolean).map(normalize).join(" ");
      return haystack.includes(q);
    });
    const statusPriority = { upcoming: 0, live: 1, finished: 2 };
    const upcoming = matches.filter((m) => m.status === "upcoming")
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const live = matches.filter((m) => m.status === "live")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const finished = matches.filter((m) => m.status === "finished")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return [...upcoming, ...live, ...finished].slice(0, 8);
  }, [searchQuery, sportsData?.matches]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const handleSelectResult = (matchId) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/events/${matchId}`);
  };

  const handleSeeAll = () => {
    setSearchOpen(false);
    const q = encodeURIComponent(searchQuery);
    navigate(`/events?q=${q}`);
  };

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
          <div className="apex-sidebar-avatar-wrap">
            <Link to="/profile" className="apex-sidebar-avatar">
              <Smile size={48} strokeWidth={1.5} />
            </Link>
            <Link to="/profile" className="apex-sidebar-avatar-edit" aria-label="Editar perfil">
              <Pencil size={12} />
            </Link>
          </div>
          <div className="apex-sidebar-user">
            <strong>{user?.username || "Jordi"}</strong>
            <div className="apex-sidebar-coins-row">
              <Coins size={16} />
              <b>{(user?.points || 0).toLocaleString("es-ES")}</b>
              <span>Coins</span>
            </div>
            <div className={`apex-sidebar-pending-badge ${pendingCoins > 0 ? "has-pending" : ""}`}>
              {pendingCoins > 0
                ? `${pendingCoins.toLocaleString("es-ES")} coins pendientes`
                : "Sin coins pendientes"}
            </div>
            <div className="apex-sidebar-level">
              <div className="apex-sidebar-level-row">
                <span>Nivel <b>{user?.level || 24}</b></span>
                <small>2.450 / 3.000 XP</small>
              </div>
              <span className="apex-sidebar-progress"><i style={{ width: "82%" }} /></span>
            </div>
            <Link to="/" className="apex-sidebar-home-btn" onClick={() => setMenuOpen(false)}>
              <Home size={16} /> Inicio
            </Link>
          </div>
        </div>

        <nav>
          <NavItem item={CORE_NAV[0]} />

          <button
            type="button"
            className={`apex-sidebar-toggle${eventsExpanded ? " open" : ""}`}
            onClick={() => setEventsExpanded((p) => !p)}
          >
            <Trophy size={20} strokeWidth={2} />
            <span>Eventos</span>
            <ChevronDown size={16} className="apex-sidebar-chevron" />
          </button>
          {eventsExpanded && (
            <div className="apex-sidebar-subnav">
              <NavLink to="/events" end onClick={() => setEventsExpanded(false)} className="apex-sidebar-sport">
                <span className="apex-sidebar-sport-icon" style={{ background: "#2dd4bf" }}>T</span>
                <span className="apex-sidebar-sport-label">Todos los deportes</span>
              </NavLink>
              {SPORT_FILTERS.map((sport) => (
                <NavLink
                  key={sport.key}
                  to={`/events?sport=${sport.key}`}
                  onClick={() => setEventsExpanded(false)}
                  className="apex-sidebar-sport"
                >
                  <span className="apex-sidebar-sport-icon" style={{ background: sport.color }}>
                    {sport.label[0]}
                  </span>
                  <span className="apex-sidebar-sport-label">{sport.label}</span>
                </NavLink>
              ))}
            </div>
          )}

          <NavItem item={CORE_NAV[2]} />
          <NavItem item={CORE_NAV[3]} />

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
        <div className="apex-header-search-inline desktop-only" onClick={() => setSearchOpen(true)}>
          <Search size={18} />
          <span>Buscar eventos, ligas, equipos…</span>
        </div>
        <nav className="apex-header-tabs desktop-only">
          <NavLink
            to="/events?tab=live"
            className={({ isActive }) => {
              const tab = new URLSearchParams(search).get("tab");
              return `apex-header-tab ${pathname === "/events" && tab === "live" ? "active" : ""}`;
            }}
          >
            <Radio size={15} /> En Vivo
          </NavLink>
          <NavLink
            to="/events"
            end
            className={({ isActive }) => {
              const tab = new URLSearchParams(search).get("tab");
              return `apex-header-tab ${(isActive && tab !== "live" && tab !== "finished") ? "active" : ""}`;
            }}
          >
            <Calendar size={15} /> Próximos
          </NavLink>
          <NavLink
            to="/events?tab=finished"
            className={({ isActive }) => {
              const tab = new URLSearchParams(search).get("tab");
              return `apex-header-tab ${pathname === "/events" && tab === "finished" ? "active" : ""}`;
            }}
          >
            <CheckCircle2 size={15} /> Resultados
          </NavLink>
        </nav>
        <div className="apex-top-actions">
          {isHome && (
            <NavLink to="/earn" className="apex-topbar-video-cta" aria-label="Mira un video y gana 15 coins">
              <PlayCircle size={15} fill="#fff" stroke="#ff6b57" />
              <span>Mira este video y gana <b>15 coins</b></span>
            </NavLink>
          )}
          <button className="apex-search-button mobile-only" type="button" aria-label="Buscar eventos" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
          <span className="apex-coins"><CircleDollarSign size={19} /><b>{(user?.points || 0).toLocaleString("es-ES")}</b><small>Coins</small></span>
          {isHome && <span className="apex-level">LVL 12</span>}
          <button type="button" className="apex-header-bell" aria-label="Notificaciones">
            <Bell size={19} />
            <span className="apex-header-bell-dot" />
          </button>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Flame size={18} style={{ color: "#ff6b57", flexShrink: 0 }} />
            <span style={{ fontSize: "0.85rem", color: "#ffd" }}>
              <strong style={{ color: "#ff6b57" }}>Te quedan {user.points} coins</strong> — mira un video y consigue más gratis
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

      {searchOpen && (
        <div className="apex-header-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="apex-header-search-panel" onClick={(e) => e.stopPropagation()}>
            <div className="apex-header-search-input-wrap">
              <Search size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar eventos, equipos, ligas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchResults.length > 0) handleSelectResult(searchResults[0].id); }}
                className="apex-header-search-input"
              />
              <button type="button" className="apex-header-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="apex-header-search-results">
              {searchQuery.trim() === "" ? (
                <div className="apex-header-search-empty">
                  <Search size={32} />
                  <p>Busca equipos, ligas o deportes</p>
                  <small>Ej: "Real Madrid", "NBA", "Alonso", "ACB"</small>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="apex-header-search-empty">
                  <Search size={32} />
                  <p>Sin resultados para "{searchQuery}"</p>
                </div>
              ) : (
                <>
                  {searchResults.map((match) => {
                    const statusLabel = match.status === "live" ? "EN VIVO" : match.status === "finished" ? "FINALIZADO" : new Date(match.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
                    return (
                      <button key={match.id} type="button" className="apex-header-search-item" onClick={() => handleSelectResult(match.id)}>
                        <div className="apex-header-search-item-main">
                          <strong>{match.home} vs {match.away}</strong>
                          <small>{match.league || match.sportName} · {statusLabel}{match.elapsed ? ` · ${match.elapsed}` : ""}</small>
                        </div>
                        <span className={`apex-header-search-item-status is-${match.status}`}>{match.status === "live" ? "LIVE" : match.status === "finished" ? "FT" : "PRÓX"}</span>
                      </button>
                    );
                  })}
                  <button type="button" className="apex-header-search-see-all" onClick={handleSeeAll}>
                    Ver todos los resultados de "{searchQuery}" →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
