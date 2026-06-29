import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Activity, Calendar, Copy, Crown, Edit3, Globe, KeyRound, Lock,
  Settings, Share2, Shield, Sparkles, Target, TrendingDown, TrendingUp,
  Trophy, Users, X,
} from "lucide-react";
import {
  getLeagueActivity, getLeagueMemberStats, getLeagueRankingV2,
  getUserPredictions, leaveLeague, recordLeagueActivity,
} from "../data/store";

function TypeBadge({ type }) {
  const meta = {
    predictions: { label: "Predicciones", color: "#047857", icon: Target },
    mixed:       { label: "Mixta",        color: "#7c3aed", icon: Sparkles },
    fantasy:     { label: "Fantasy",      color: "#f59e0b", icon: Trophy },
  }[type] || { label: type, color: "#6b7280", icon: Trophy };
  const Icon = meta.icon;
  return (
    <span className="apex-league-type-badge" style={{ background: meta.color }}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="apex-copy-code" onClick={handle} title="Copiar código">
      <KeyRound size={12} />
      <code>{code}</code>
      <Copy size={11} />
      {copied && <em>¡Copiado!</em>}
    </button>
  );
}

function LeagueSummary({ league, ranking, matches }) {
  const me = ranking.find((r) => r.userId === "current_user");
  const top3 = ranking.slice(0, 3);
  return (
    <div className="apex-league-summary">
      <div className="apex-league-summary-stats">
        <div>
          <small>Miembros</small>
          <strong>{league.members.length}{league.maxMembers ? `/${league.maxMembers}` : ""}</strong>
        </div>
        <div>
          <small>Mi puesto</small>
          <strong>#{me?.position ?? "—"}</strong>
        </div>
        <div>
          <small>Mis puntos</small>
          <strong>{me?.total?.toLocaleString("es-ES") ?? 0}</strong>
        </div>
        <div>
          <small>Aciertos</small>
          <strong>{me?.accuracy ?? 0}%</strong>
        </div>
        <div>
          <small>Predicciones</small>
          <strong>{me?.totalPreds ?? 0}</strong>
        </div>
        <div>
          <small>Coste</small>
          <strong>{league.entryCost > 0 ? `${league.entryCost}c` : "Gratis"}</strong>
        </div>
      </div>

      {top3.length > 0 && (
        <div className="apex-league-podium">
          {top3.map((row, i) => (
            <div key={row.userId} className={`apex-league-podium-card rank-${i + 1} ${row.userId === "current_user" ? "is-me" : ""}`}>
              <span className="apex-league-podium-medal">{["🥇", "🥈", "🥉"][i]}</span>
              <strong>{row.username}</strong>
              <span className="apex-league-podium-points">{row.total?.toLocaleString("es-ES") ?? 0} pts</span>
              {row.accuracy !== undefined && <small>{row.accuracy}% acierto</small>}
            </div>
          ))}
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="apex-league-next-matches">
          <h4><Calendar size={14} /> Próximos partidos para predicción</h4>
          <ul>
            {matches.slice(0, 3).map((m) => (
              <li key={m.id}>
                <span>{m.home} vs {m.away}</span>
                <small>{new Date(m.date).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LeagueRankingTable({ ranking, league }) {
  if (!ranking || ranking.length === 0) {
    return (
      <div className="apex-empty">
        <Trophy size={28} />
        <strong>Aún no hay miembros</strong>
        <small>Cuando alguien se una, aparecerá en el ranking.</small>
      </div>
    );
  }
  const showBreakdown = league?.type === "mixed";
  return (
    <div className="apex-league-ranking">
      <div className="apex-league-ranking-head">
        <span>#</span>
        <span>Miembro</span>
        {showBreakdown && <span>Pred.</span>}
        {showBreakdown && <span>Fantasy</span>}
        <span>Acierto</span>
        <span>Total</span>
      </div>
      {ranking.map((row) => {
        const TrendIcon = row.trend === "up" ? TrendingUp : row.trend === "down" ? TrendingDown : Activity;
        return (
          <div key={row.userId} className={`apex-league-ranking-row ${row.userId === "current_user" ? "is-me" : ""}`}>
            <div className="apex-league-rank-num">
              <span>{row.position}</span>
              <TrendIcon size={11} className={`trend-${row.trend}`} />
            </div>
            <div className="apex-league-rank-user">
              <span className="apex-league-rank-avatar">{row.username?.[0]?.toUpperCase() || "?"}</span>
              <div>
                <strong>{row.username}</strong>
                <small>{row.role === "owner" ? "Owner" : "Miembro"}</small>
              </div>
            </div>
            {showBreakdown && <span className="apex-league-rank-num-cell">{row.predictionTotal?.toLocaleString() ?? 0}</span>}
            {showBreakdown && <span className="apex-league-rank-num-cell">{row.fantasyTotal?.toLocaleString() ?? 0}</span>}
            <span className="apex-league-rank-acc">
              <span className="apex-league-acc-bar"><i style={{ width: `${row.accuracy || 0}%` }} /></span>
              {row.accuracy ?? 0}%
            </span>
            <span className="apex-league-rank-total">{row.total?.toLocaleString("es-ES") ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeagueMembersList({ ranking, league }) {
  return (
    <div className="apex-league-members">
      {ranking.map((row) => (
        <article key={row.userId} className={`apex-league-member-card ${row.userId === "current_user" ? "is-me" : ""}`}>
          <div className="apex-league-member-avatar">{row.username?.[0]?.toUpperCase() || "?"}</div>
          <div className="apex-league-member-info">
            <strong>{row.username}</strong>
            <small>
              {row.role === "owner" && <><Crown size={11} /> Owner · </>}
              Puesto #{row.position}
            </small>
            <small>Unido {new Date(row.joinedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</small>
          </div>
          <div className="apex-league-member-stats">
            <div>
              <small>Predicciones</small>
              <strong>{row.totalPreds}</strong>
            </div>
            <div>
              <small>Aciertos</small>
              <strong>{row.correct}</strong>
            </div>
            <div>
              <small>Acierto</small>
              <strong>{row.accuracy}%</strong>
            </div>
            <div>
              <small>Total</small>
              <strong>{row.total?.toLocaleString("es-ES")}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LeagueActivity({ activities, allUsers }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="apex-empty">
        <Activity size={28} />
        <strong>Sin actividad</strong>
        <small>Las acciones de los miembros aparecerán aquí.</small>
      </div>
    );
  }
  return (
    <ul className="apex-activity-feed">
      {activities.map((a) => {
        const user = allUsers.find((u) => u.id === a.userId);
        return (
          <li key={a.id}>
            <span className="apex-activity-dot" />
            <div>
              <strong>{user?.username || a.userId}</strong> {a.message}
              <small>{new Date(a.createdAt).toLocaleString("es-ES")}</small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LeagueSettings({ league, onLeave, onUpdate, isOwner, busy }) {
  const [description, setDescription] = useState(league.description || "");
  const [maxMembers, setMaxMembers] = useState(league.maxMembers || "");
  const [scoring, setScoring] = useState({
    predictionWeight: league.scoringConfig?.predictionWeight ?? 1,
    fantasyWeight: league.scoringConfig?.fantasyWeight ?? 1,
    quinielaWeight: league.scoringConfig?.quinielaWeight ?? 1,
    porraWeight: league.scoringConfig?.porraWeight ?? 1,
  });
  return (
    <div className="apex-league-settings">
      <div className="apex-league-settings-section">
        <h4><Shield size={14} /> Visibilidad y código</h4>
        <div className="apex-league-info-row">
          <span>Visibilidad</span>
          <strong>{league.visibility === "public" ? <><Globe size={13} /> Pública</> : <><Lock size={13} /> Privada</>}</strong>
        </div>
        <div className="apex-league-info-row">
          <span>Código</span>
          <CopyCode code={league.code} />
        </div>
        <div className="apex-league-info-row">
          <span>Competición</span>
          <strong>{league.competition === "all" ? "Todas" : league.competition}</strong>
        </div>
        <div className="apex-league-info-row">
          <span>Coste de entrada</span>
          <strong>{league.entryCost > 0 ? `${league.entryCost} coins` : "Gratis"}</strong>
        </div>
        <div className="apex-league-info-row">
          <span>Premio acumulado</span>
          <strong>{league.prizePool || 0} coins</strong>
        </div>
      </div>

      {isOwner && (
        <div className="apex-league-settings-section">
          <h4><Edit3 size={14} /> Configuración editable</h4>
          <label>
            <span>Descripción</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
            />
          </label>
          <label>
            <span>Máx. miembros</span>
            <input
              type="number"
              min="2"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="Sin límite"
            />
          </label>
          {league.type === "mixed" && (
            <div className="apex-league-scoring-edit">
              <small>Ponderación de cada modo</small>
              <div className="apex-league-scoring-grid">
                {[
                  { key: "predictionWeight", label: "Predicciones", color: "#047857" },
                  { key: "fantasyWeight", label: "Fantasy", color: "#f59e0b" },
                  { key: "quinielaWeight", label: "Quinielas", color: "#3b82f6" },
                  { key: "porraWeight", label: "Porras", color: "#7c3aed" },
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
                  </label>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className="apex-btn-primary"
            disabled={busy}
            onClick={() => onUpdate({ description, maxMembers: maxMembers ? Number(maxMembers) : null, scoring })}
          >
            Guardar cambios
          </button>
        </div>
      )}

      {!isOwner && (
        <div className="apex-league-settings-section">
          <button
            type="button"
            className="apex-btn-ghost is-danger"
            disabled={busy}
            onClick={onLeave}
          >
            <X size={14} /> Salir de la liga
          </button>
        </div>
      )}
    </div>
  );
}

export default function LeagueDetail({ store, allUsers = [], matches = [] }) {
  const { leagueId } = useParams();
  const [tab, setTab] = useState("summary");
  const league = useMemo(() => (store.leagues || []).find((l) => l.id === leagueId), [store.leagues, leagueId]);
  const ranking = useMemo(() => league ? getLeagueRankingV2(store, league.id, matches, allUsers) : [], [store, league, matches, allUsers]);
  const activities = useMemo(() => league ? getLeagueActivity(store, league.id, 20) : [], [store, league]);
  const isOwner = league?.ownerId === "current_user";
  const isMember = league?.members.some((m) => m.userId === "current_user");

  if (!league) {
    return (
      <div className="apex-page">
        <h1>Liga no encontrada</h1>
        <Link to="/leagues" className="apex-btn-secondary">Volver a ligas</Link>
      </div>
    );
  }

  const handleLeave = () => {
    if (!confirm(`¿Salir de "${league.name}"?`)) return;
    leaveLeague(store, league.id, "current_user");
  };

  const handleUpdate = (patch) => {
    if (patch.description !== undefined) league.description = patch.description;
    if (patch.maxMembers !== undefined) league.maxMembers = patch.maxMembers;
    if (patch.scoring) {
      league.scoringConfig = {
        predictionWeight: patch.scoring.predictionWeight,
        fantasyWeight: patch.scoring.fantasyWeight,
        quinielaWeight: patch.scoring.quinielaWeight,
        porraWeight: patch.scoring.porraWeight,
      };
    }
    league.updatedAt = new Date().toISOString();
    recordLeagueActivity(store, league.id, "current_user", "league_updated", `actualizó la configuración de "${league.name}"`);
  };

  const TABS = [
    { id: "summary", label: "Resumen", icon: Sparkles },
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "predictions", label: "Predicciones", icon: Target },
    { id: "members", label: "Miembros", icon: Users },
    { id: "activity", label: "Actividad", icon: Activity },
    { id: "settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <div className="apex-page apex-league-detail-page">
      <header className="apex-league-detail-header">
        <div className="apex-league-detail-top">
          <Link to="/leagues" className="apex-back-link">← Mis ligas</Link>
          <div className="apex-league-detail-actions">
            <CopyCode code={league.code} />
            <button type="button" className="apex-btn-secondary" title="Compartir">
              <Share2 size={14} /> Compartir
            </button>
            {!isOwner && isMember && (
              <button type="button" className="apex-btn-ghost is-danger" onClick={handleLeave}>
                <X size={14} /> Salir
              </button>
            )}
          </div>
        </div>
        <div className="apex-league-detail-title">
          <TypeBadge type={league.type} />
          <h1>{league.name}</h1>
          {isOwner && <span className="apex-league-owner-chip"><Crown size={12} /> Owner</span>}
        </div>
        {league.description && <p className="apex-league-detail-desc">{league.description}</p>}
        <div className="apex-league-detail-meta">
          <span><Users size={13} /> {league.members.length}{league.maxMembers ? `/${league.maxMembers}` : ""} miembros</span>
          <span><Trophy size={13} /> {league.entryCost > 0 ? `${league.entryCost} c/u` : "Gratis"}</span>
          <span>{league.visibility === "public" ? <><Globe size={13} /> Pública</> : <><Lock size={13} /> Privada</>}</span>
          <span><Target size={13} /> {league.competition === "all" ? "Todas" : league.competition}</span>
        </div>
      </header>

      <nav className="apex-league-detail-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </nav>

      <section className="apex-league-detail-body">
        {tab === "summary" && <LeagueSummary league={league} ranking={ranking} matches={matches} />}
        {tab === "ranking" && <LeagueRankingTable ranking={ranking} league={league} />}
        {tab === "predictions" && (
          <LeaguePredictionsView store={store} league={league} matches={matches} />
        )}
        {tab === "members" && <LeagueMembersList ranking={ranking} league={league} />}
        {tab === "activity" && <LeagueActivity activities={activities} allUsers={allUsers} />}
        {tab === "settings" && (
          <LeagueSettings
            league={league}
            onLeave={handleLeave}
            onUpdate={handleUpdate}
            isOwner={isOwner}
            busy={false}
          />
        )}
      </section>
    </div>
  );
}

function LeaguePredictionsView({ store, league, matches }) {
  const userPreds = getUserPredictions(store, "current_user")
    .filter((p) => {
      if (!league || league.competition === "all") return true;
      const match = matches.find((m) => m.id === p.matchId);
      if (!match) return true;
      const comp = league.competition.toLowerCase();
      const ml = (match.league || "").toLowerCase();
      if (comp.includes("laliga")) return ml.includes("la liga") || ml.includes("laliga");
      if (comp.includes("champion")) return ml.includes("champion");
      if (comp.includes("premier")) return ml.includes("premier");
      return ml.includes(comp);
    })
    .map((p) => ({ ...p, match: matches.find((m) => m.id === p.matchId) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (userPreds.length === 0) {
    return (
      <div className="apex-empty">
        <Target size={32} />
        <strong>No has hecho predicciones en esta liga</strong>
        <small>Ve a la sección de Predicciones y haz tu primer pronóstico.</small>
      </div>
    );
  }
  return (
    <div className="apex-league-predictions">
      {userPreds.map((p) => {
        const status = p.status || "pending";
        return (
          <article key={p.id} className={`apex-league-pred-item is-${status}`}>
            <div className="apex-league-pred-info">
              <strong>{p.match?.home || p.matchId} vs {p.match?.away || ""}</strong>
              <small>
                {p.match?.league} · {p.match?.date ? new Date(p.match.date).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
              </small>
            </div>
            <span className={`apex-league-pred-pick is-${p.selection}`}>{p.selection}</span>
            <div className="apex-league-pred-points">
              <strong>{p.pointsWon?.toLocaleString() ?? 0}</strong>
              <small>{p.pointsBet} apostados</small>
            </div>
            <span className={`apex-league-pred-status is-${status}`}>
              {status === "won" ? "✓ Acertada" : status === "lost" ? "✗ Fallada" : "⏳ Pendiente"}
            </span>
          </article>
        );
      })}
    </div>
  );
}
