import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, BriefcaseBusiness, Calendar, ChevronRight, ClipboardList, Copy,
  Crown, DollarSign, Filter, Globe, KeyRound, Layers, LineChart,
  Lock, PlusCircle, Search, Settings, Sparkles, Target, TrendingDown,
  Trophy, Users, X
} from "lucide-react";
import {
  createLeague, getLeagueActivity, getLeagueRankingV2, joinLeague, leaveLeague,
} from "../data/store";

const LEAGUE_TYPES = [
  {
    id: "predictions",
    label: "Liga de Predicciones",
    short: "Predicciones",
    icon: Target,
    color: "#047857",
    accent: "#d1fae5",
    tagline: "Compite por tus aciertos en pronósticos 1X2",
    description: "Cada miembro suma los puntos que gana al acertar sus pronósticos deportivos (1, X o 2). El ranking se ordena por puntos totales y como desempate, por porcentaje de acierto.",
    howItWorks: [
      "Haces pronósticos desde la sección Predicciones con coins.",
      "Si aciertas, recibes puntos = apuesta × cuota.",
      "Cuantos más pronósticos acertados (y con mejor porcentaje), más arriba en el ranking.",
    ],
    bestFor: "Amigos que solo juegan predicciones, sin complicarse con alineaciones o equipos fantasy.",
    example: "Aciertas 7/10 pronósticos con cuota media 2.5 → unos 850 pts. Tu amigo solo 5/10 pero con cuota 3.0 → 600 pts. Ganas tú.",
  },
  {
    id: "mixed",
    label: "Liga Mixta",
    short: "Mixta",
    icon: Layers,
    color: "#7c3aed",
    accent: "#ede9fe",
    tagline: "Combina predicciones, fantasy, quinielas y porras en un único ranking",
    description: "Suma puntos de TODOS los modos de juego disponibles. Tú decides el peso de cada modo (p. ej. que fantasy valga el doble que predicciones). Ideal para competir con amigos que juegan a cosas distintas.",
    howItWorks: [
      "Cada modo aporta sus propios puntos (predicciones, fantasy, quinielas, porras).",
      "Al crear la liga, defines el peso de cada modo con un multiplicador (×0 a ×5).",
      "Total = (pred×pesoPred) + (fantasy×pesoFantasy) + (quiniela×pesoQ) + (porra×pesoP).",
    ],
    bestFor: "Grupos donde unos juegan predicciones, otros prefieren fantasy, y no queréis hacer dos ligas separadas.",
    example: "Peso Pred ×1, Fantasy ×2. Tú haces 500 pts en predicciones y 1000 en fantasy → 2500 pts. Otro solo juega fantasy con 1500 pts → 3000 pts. Gana él.",
    extra: "Puedes rebalancear los pesos en cualquier momento desde Ajustes de la liga.",
  },
  {
    id: "fantasy",
    label: "Liga Fantasy",
    short: "Fantasy",
    icon: Trophy,
    color: "#f59e0b",
    accent: "#fef3c7",
    tagline: "Solo puntos de tu equipo fantasy (próximamente)",
    description: "El ranking se calcula únicamente con los puntos que tu equipo fantasy consiga cada jornada.",
    howItWorks: [
      "Creas tu equipo fantasy con presupuesto y alineación.",
      "Cada jornada recibes puntos según el rendimiento real de tus jugadores.",
      "El ranking de la liga = suma de puntos fantasy.",
    ],
    bestFor: "Jugadores que ya usan el módulo Fantasy y quieren competir entre ellos en una mini-liga privada.",
    example: "Alinear a Mbappé, Bellingham y Pedri. Acumulas 187 pts en la jornada 1, 142 en la 2, 198 en la 3. Total 527 pts en 3 jornadas.",
    disabled: true,
    disabledReason: "El módulo Fantasy se está migrando al nuevo sistema. Disponible en las próximas semanas.",
  },
];

const COMPETITIONS = [
  { id: "all", label: "Todas" },
  { id: "LaLiga", label: "LaLiga" },
  { id: "Champions", label: "Champions League" },
  { id: "Premier", label: "Premier League" },
  { id: "Serie A", label: "Serie A" },
  { id: "Bundesliga", label: "Bundesliga" },
];

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function LeagueTypeCard({ type, active, onSelect }) {
  const [expanded, setExpanded] = useState(active);
  const Icon = type.icon;
  const isActive = active;
  const isExpanded = expanded;
  const handleSelect = () => {
    if (type.disabled) return;
    onSelect(type.id);
  };
  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={`apex-league-type-card ${isActive ? "active" : ""} ${type.disabled ? "is-disabled" : ""} ${isExpanded ? "is-expanded" : ""}`}
      onClick={handleSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(); } }}
      style={isActive ? { borderColor: type.color, boxShadow: `0 0 0 3px ${type.color}22` } : undefined}
    >
      <div className="apex-league-type-head-row">
        <div className="apex-league-type-icon" style={{ background: type.color }}>
          <Icon size={22} />
        </div>
        <div className="apex-league-type-head-info">
          <div className="apex-league-type-head">
            <strong>{type.label}</strong>
            {type.disabled && <em>Próximamente</em>}
          </div>
          <span className="apex-league-type-tagline" style={{ color: type.color }}>{type.tagline}</span>
        </div>
        <button
          type="button"
          className="apex-league-type-toggle"
          onClick={toggleExpand}
          aria-label={isExpanded ? "Ver menos" : "Ver más"}
          tabIndex={-1}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>
      <div className="apex-league-type-content">
        {isExpanded && (
          <>
            <p>{type.description}</p>
            <ul>
              {type.howItWorks.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
            <div className="apex-league-type-meta">
              <span><strong>Ideal para:</strong> {type.bestFor}</span>
            </div>
            <div className="apex-league-type-example">
              <small>Ejemplo</small>
              <span>{type.example}</span>
            </div>
            {type.extra && <p className="apex-league-type-extra">{type.extra}</p>}
            {type.disabledReason && <p className="apex-league-type-extra">{type.disabledReason}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueTypeSelector({ value, onChange }) {
  return (
    <div className="apex-league-type-grid">
      {LEAGUE_TYPES.map((t) => (
        <LeagueTypeCard
          key={t.id}
          type={t}
          active={value === t.id}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

function VisibilityToggle({ value, onChange }) {
  return (
    <div className="apex-league-vis-toggle">
      <button
        type="button"
        className={value === "private" ? "active" : ""}
        onClick={() => onChange("private")}
      >
        <Lock size={16} />
        <strong>Privada</strong>
        <small>Solo con código de invitación</small>
      </button>
      <button
        type="button"
        className={value === "public" ? "active" : ""}
        onClick={() => onChange("public")}
      >
        <Globe size={16} />
        <strong>Pública</strong>
        <small>Aparece en exploración para todos</small>
      </button>
    </div>
  );
}

function CreateLeagueForm({ onSubmit, onCancel, busy }) {
  const [type, setType] = useState("predictions");
  const [visibility, setVisibility] = useState("private");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [competition, setCompetition] = useState("all");
  const [entryCost, setEntryCost] = useState(0);
  const [maxMembers, setMaxMembers] = useState("");
  const [scoring, setScoring] = useState({ prediction: 1, fantasy: 1, quiniela: 1, porra: 1 });
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e?.preventDefault();
    setError("");
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    try {
      const league = onSubmit({
        name: name.trim(),
        type,
        visibility,
        description: description.trim(),
        competition,
        entryCost: Number(entryCost) || 0,
        maxMembers: maxMembers ? Number(maxMembers) : null,
        scoringConfig: {
          predictionWeight: scoring.prediction,
          fantasyWeight: scoring.fantasy,
          quinielaWeight: scoring.quiniela,
          porraWeight: scoring.porra,
        },
      });
      return league;
    } catch (err) {
      setError(err.message || "No se pudo crear la liga");
    }
  };

  return (
    <form className="apex-league-create-form" onSubmit={handleSubmit}>
      <div className="apex-league-form-section">
        <h3>1. Tipo de liga</h3>
        <LeagueTypeSelector value={type} onChange={setType} />
      </div>

      <div className="apex-league-form-section">
        <h3>2. Visibilidad</h3>
        <VisibilityToggle value={visibility} onChange={setVisibility} />
      </div>

      <div className="apex-league-form-section">
        <h3>3. Información básica</h3>
        <div className="apex-league-form-grid">
          <label>
            <span>Nombre de la liga *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Liga Amigos Predicciones"
              maxLength={60}
            />
          </label>
          <label>
            <span>Competición</span>
            <select value={competition} onChange={(e) => setCompetition(e.target.value)}>
              {COMPETITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="apex-league-form-full">
            <span>Descripción</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el objetivo o reglas especiales (opcional)"
              maxLength={200}
              rows={2}
            />
          </label>
        </div>
      </div>

      <div className="apex-league-form-section">
        <h3>4. Configuración</h3>
        <div className="apex-league-form-grid">
          <label>
            <span>Coste de entrada (coins)</span>
            <input
              type="number"
              min="0"
              value={entryCost}
              onChange={(e) => setEntryCost(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0 = gratis"
            />
          </label>
          <label>
            <span>Máx. miembros (opcional)</span>
            <input
              type="number"
              min="2"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="Sin límite"
            />
          </label>
        </div>
      </div>

      {type === "mixed" && (
        <div className="apex-league-form-section">
          <h3>5. Ponderación mixta</h3>
          <p className="apex-league-form-hint">
            Asigna el peso de cada modo en el ranking final. El valor por defecto es 1× para todos.
          </p>
          <div className="apex-league-scoring-grid">
            {[
              { key: "prediction", label: "Predicciones", color: "#047857" },
              { key: "fantasy", label: "Fantasy", color: "#f59e0b" },
              { key: "quiniela", label: "Quinielas", color: "#3b82f6" },
              { key: "porra", label: "Porras", color: "#7c3aed" },
            ].map((m) => (
              <label key={m.key}>
                <span style={{ color: m.color }}>● {m.label}</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.5"
                  value={scoring[m.key]}
                  onChange={(e) => setScoring((s) => ({ ...s, [m.key]: Math.max(0, Number(e.target.value) || 0) }))}
                />
                <small>× {scoring[m.key]}</small>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="apex-league-form-error">{error}</p>}

      <div className="apex-league-form-actions">
        <button type="button" onClick={onCancel} className="apex-btn-ghost">Cancelar</button>
        <button type="submit" disabled={busy} className="apex-btn-primary">
          <PlusCircle size={16} /> Crear liga
        </button>
      </div>
    </form>
  );
}

function JoinLeagueForm({ onSubmit, onCancel, busy, error }) {
  const [code, setCode] = useState("");
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    try {
      onSubmit(code.trim().toUpperCase());
    } catch (err) {
      // Error propagado por el padre via `error`
    }
  };
  return (
    <form className="apex-league-join-form" onSubmit={handleSubmit}>
      <KeyRound size={28} />
      <h3>Unirse con código</h3>
      <p>Pide el código al admin de la liga y pégalo aquí.</p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="CÓDIGO-2024"
        maxLength={20}
        autoFocus
      />
      {error && <p className="apex-league-form-error">{error}</p>}
      <div className="apex-league-form-actions">
        <button type="button" onClick={onCancel} className="apex-btn-ghost">Cancelar</button>
        <button type="submit" disabled={busy || !code.trim()} className="apex-btn-primary">
          Unirme
        </button>
      </div>
    </form>
  );
}

function MyLeagueCard({ league, ranking, onLeave, busy }) {
  const isOwner = league.ownerId === "current_user";
  const isPublic = league.visibility === "public";
  const typeMeta = LEAGUE_TYPES.find((t) => t.id === league.type) || LEAGUE_TYPES[0];
  const TypeIcon = typeMeta.icon;
  const myRow = ranking.find((r) => r.userId === "current_user");
  return (
    <article className="apex-my-league-card">
      <header>
        <div className="apex-my-league-logo" style={{ background: typeMeta.color }}>
          <TypeIcon size={18} />
        </div>
        <div className="apex-my-league-info">
          <strong>{league.name}</strong>
          <small>
            {isPublic ? <><Globe size={11} /> Pública</> : <><Lock size={11} /> Privada</>}
            {" · "}{league.members.length}{league.maxMembers ? `/${league.maxMembers}` : ""} miembros
          </small>
        </div>
        {isOwner && <span className="apex-my-league-owner-tag"><Crown size={11} /> Owner</span>}
      </header>
      <div className="apex-my-league-stats">
        <div>
          <small>Mi puesto</small>
          <strong>#{myRow?.position ?? "—"}</strong>
        </div>
        <div>
          <small>Mis puntos</small>
          <strong>{myRow?.total?.toLocaleString("es-ES") ?? 0}</strong>
        </div>
        <div>
          <small>Premio</small>
          <strong>{league.entryCost > 0 ? `${league.entryCost} c/u` : "Gratis"}</strong>
        </div>
      </div>
      <div className="apex-my-league-actions">
        <Link to={`/leagues/${league.id}`} className="apex-btn-secondary">
          Ver liga <ChevronRight size={14} />
        </Link>
        {!isOwner && (
          <button type="button" className="apex-btn-ghost" disabled={busy} onClick={() => onLeave(league.id)}>
            Salir
          </button>
        )}
      </div>
    </article>
  );
}

function PublicLeaguesList({ leagues, allUsers, onJoin, busy }) {
  return (
    <div className="apex-public-leagues-list">
      {leagues.length === 0 ? (
        <div className="apex-empty">
          <Globe size={32} />
          <strong>No hay ligas públicas todavía</strong>
          <small>Cuando alguien cree una liga pública, aparecerá aquí.</small>
        </div>
      ) : (
        leagues.map((league) => {
          const typeMeta = LEAGUE_TYPES.find((t) => t.id === league.type) || LEAGUE_TYPES[0];
          const TypeIcon = typeMeta.icon;
          const isMember = league.members.some((m) => m.userId === "current_user");
          return (
            <article key={league.id} className="apex-public-league-card">
              <div className="apex-public-league-icon" style={{ background: typeMeta.color }}>
                <TypeIcon size={18} />
              </div>
              <div className="apex-public-league-body">
                <strong>{league.name}</strong>
                <small>{league.description || `Liga de ${typeMeta.label.toLowerCase()}`}</small>
                <div className="apex-public-league-meta">
                  <span><Users size={11} /> {league.members.length}{league.maxMembers ? `/${league.maxMembers}` : ""}</span>
                  <span><Trophy size={11} /> {league.entryCost > 0 ? `${league.entryCost} c/u` : "Gratis"}</span>
                  <span><Globe size={11} /> Pública</span>
                </div>
              </div>
              <button
                type="button"
                disabled={busy || isMember}
                onClick={() => onJoin(league.code)}
                className="apex-btn-primary"
              >
                {isMember ? "Dentro" : "Unirme"}
              </button>
            </article>
          );
        })
      )}
    </div>
  );
}

function LeagueActivityFeed({ activities, allUsers }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="apex-empty">
        <Activity size={28} />
        <strong>Sin actividad reciente</strong>
        <small>Las acciones de los miembros aparecerán aquí.</small>
      </div>
    );
  }
  return (
    <ul className="apex-activity-feed">
      {activities.map((a) => {
        const user = allUsers.find((u) => u.id === a.userId);
        const username = user?.username || a.userId;
        return (
          <li key={a.id}>
            <span className="apex-activity-dot" />
            <div>
              <strong>{username}</strong> {a.message}
              <small>{new Date(a.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Leagues({ store, onStoreChange, allUsers = [], matches = [] }) {
  const [mode, setMode] = useState(null);
  const [tab, setTab] = useState("public");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const myLeagues = useMemo(() => (store.leagues || []).filter((l) => l.members.some((m) => m.userId === "current_user")), [store.leagues]);
  const publicLeagues = useMemo(() => (store.leagues || []).filter((l) => l.visibility === "public" && !l.members.some((m) => m.userId === "current_user")), [store.leagues]);
  const rankingsByLeague = useMemo(() => {
    const map = {};
    for (const l of myLeagues) {
      map[l.id] = getLeagueRankingV2(store, l.id, matches, allUsers);
    }
    return map;
  }, [myLeagues, store, matches, allUsers]);
  const recentActivity = useMemo(() => getLeagueActivity(store, null, 12), [store, myLeagues.length]);

  const filteredMy = useMemo(() => {
    let rows = myLeagues;
    if (filter !== "all") rows = rows.filter((l) => l.type === filter);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((l) => l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q));
    }
    return rows;
  }, [myLeagues, filter, query]);

  const filteredPublic = useMemo(() => {
    let rows = publicLeagues;
    if (filter !== "all") rows = rows.filter((l) => l.type === filter);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((l) => l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q));
    }
    return rows;
  }, [publicLeagues, filter, query]);

  const handleCreate = (data) => {
    setBusy(true); setError("");
    try {
      const league = createLeague(store, data);
      onStoreChange?.();
      setMode(null);
      return league;
    } catch (err) {
      setError(err.message || "No se pudo crear la liga");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = (code) => {
    setBusy(true); setError("");
    try {
      joinLeague(store, code);
      onStoreChange?.();
      setMode(null);
    } catch (err) {
      setError(err.message || "No se pudo unir a la liga");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = (leagueId) => {
    setBusy(true); setError("");
    try {
      leaveLeague(store, leagueId, "current_user");
      onStoreChange?.();
    } catch (err) {
      setError(err.message || "No se pudo salir de la liga");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="apex-page apex-leagues-page">
      <header className="apex-leagues-top">
        <div>
          <h1>Ligas</h1>
          <p>Compite con amigos y con la comunidad en ligas de predicciones, mixtas y fantasy.</p>
        </div>
        <div className="apex-leagues-top-actions">
          <button type="button" className="apex-btn-secondary" onClick={() => setMode("join")}>
            <KeyRound size={16} /> Unirse con código
          </button>
          <button type="button" className="apex-btn-primary" onClick={() => setMode("create")}>
            <PlusCircle size={16} /> Crear liga
          </button>
        </div>
      </header>

      {error && !mode && (
        <p className="apex-leagues-error">{error}</p>
      )}

      {mode === "create" && (
        <CreateLeagueForm
          onSubmit={handleCreate}
          onCancel={() => { setMode(null); setError(""); }}
          busy={busy}
        />
      )}
      {mode === "join" && (
        <JoinLeagueForm
          onSubmit={handleJoin}
          onCancel={() => { setMode(null); setError(""); }}
          busy={busy}
          error={error}
        />
      )}

      <section className="apex-my-leagues">
        <header className="apex-section-head-inline">
          <h2><Trophy size={18} /> Mis ligas <span className="apex-section-count">{myLeagues.length}</span></h2>
        </header>
        {filteredMy.length === 0 ? (
          <div className="apex-empty">
            <Trophy size={32} />
            <strong>Aún no formas parte de ninguna liga</strong>
            <small>Crea una con el botón de arriba o únete con un código de invitación.</small>
          </div>
        ) : (
            <div className="apex-my-leagues-list">
              {filteredMy.map((league) => (
                <MyLeagueCard
                  key={league.id}
                  league={league}
                  ranking={rankingsByLeague[league.id] || []}
                  onLeave={handleLeave}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </section>

      {tab === "public" && (
        <section className="apex-public-leagues">
          <PublicLeaguesList
            leagues={filteredPublic}
            allUsers={allUsers}
            onJoin={handleJoin}
            busy={busy}
          />
        </section>
      )}

      <div className="apex-leagues-tabs">
        <button type="button" className={tab === "public" ? "active" : ""} onClick={() => setTab("public")}>
          <Globe size={14} /> Explorar públicas <span>{publicLeagues.length}</span>
        </button>
        <button type="button" className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
          <Activity size={14} /> Actividad <span>{recentActivity.length}</span>
        </button>
      </div>

      {tab === "public" && (
        <>
          <div className="apex-leagues-toolbar">
            <div className="apex-leagues-search">
              <Search size={14} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o descripción…"
              />
            </div>
            <div className="apex-leagues-filter">
              <Filter size={14} />
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todos los tipos</option>
                {LEAGUE_TYPES.filter((t) => !t.disabled).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <section className="apex-public-leagues">
            <PublicLeaguesList
              leagues={filteredPublic}
              allUsers={allUsers}
              onJoin={handleJoin}
              busy={busy}
            />
          </section>
        </>
      )}

      {tab === "activity" && (
        <section className="apex-leagues-activity">
          <header className="apex-section-header">
            <h2><Activity size={18} /> Actividad reciente</h2>
            <small>Últimos movimientos en tus ligas</small>
          </header>
          <LeagueActivityFeed activities={recentActivity} allUsers={allUsers} />
        </section>
      )}
    </div>
  );
}
