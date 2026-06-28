import { useEffect, useMemo, useState } from "react";
import { Search, Shield, TrendingUp, UserPlus, Users } from "lucide-react";

const money = (value) => `${(Number(value || 0) / 1000000).toFixed(1)} M`;
const headers = (user, leagueId) => ({
  "content-type": "application/json",
  "x-playfulbet-user": user?.id || "current_user",
  "x-playfulbet-fantasy-league": String(leagueId || 1),
});
const syncStamp = (value) => value ? new Date(value).toLocaleString("es-ES") : "pendiente";

export default function Fantasy({ user }) {
  const [tab, setTab] = useState("equipo");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("TODOS");
  const [formation, setFormation] = useState("4-3-3");
  const [starters, setStarters] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [activeLeagueId, setActiveLeagueId] = useState(1);

  const applyPayload = (payload, fallbackLeagueId = 1) => {
    setData(payload);
    setActiveLeagueId(payload.activeLeagueId || fallbackLeagueId || 1);
    if (payload.team) {
      setFormation(payload.team.formation);
      setStarters(payload.team.squad.filter((p) => p.is_starter).map((p) => p.id));
      setCaptain(payload.team.squad.find((p) => p.is_captain)?.id || null);
    } else {
      setStarters([]);
      setCaptain(null);
    }
  };

  const load = (leagueId = activeLeagueId) => fetch("/api/fantasy", { headers: headers(user, leagueId) })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      applyPayload(payload, leagueId);
    })
    .catch((err) => setError(err.message || "No se pudo cargar Fantasy"));

  useEffect(() => {
    load(activeLeagueId);
    const timer = window.setInterval(() => load(activeLeagueId), 5 * 60000);
    return () => window.clearInterval(timer);
  }, [user?.id, activeLeagueId]);

  const action = async (name, payload = {}) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/fantasy/${name}`, {
        method: "POST",
        headers: headers(user, activeLeagueId),
        body: JSON.stringify(payload),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      applyPayload(next, activeLeagueId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const market = useMemo(() => (data?.players || []).filter((p) =>
    (position === "TODOS" || p.position === position) && p.name.toLowerCase().includes(query.toLowerCase()),
  ), [data?.players, position, query]);
  const owned = new Set(data?.team?.squad.map((p) => p.id) || []);
  const leagues = data?.leagues || [];

  if (!data) return <div className="apex-page"><p>{error || "Cargando Fantasy..."}</p></div>;

  if (!data.team || data.team.squad.length === 0) return (
    <div className="apex-page apex-fantasy-page">
      <section className="apex-empty-card">
        <Shield size={42} />
        <h1>Crea tu equipo Fantasy</h1>
        <p>Recibiras 13 jugadores iniciales para competir en la liga seleccionada.</p>
        {!!leagues.length && (
          <select value={activeLeagueId} onChange={(e) => { const leagueId = Number(e.target.value); setActiveLeagueId(leagueId); load(leagueId); }}>
            {leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
        <button disabled={busy} onClick={() => action("team", { name: `${user?.username || "Mi"} XI` })}>Crear equipo</button>
      </section>
      {error && <p className="apex-error">{error}</p>}
    </div>
  );

  const team = data.team;
  return (
    <div className="apex-page apex-fantasy-page" style={{ maxWidth: 1180 }}>
      <nav className="apex-subtabs">
        {[["equipo", "Mi equipo"], ["mercado", "Mercado"], ["ranking", "Ranking"], ["ligas", "Ligas privadas"]].map(([id, label]) =>
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <section className="apex-fantasy-heading">
        <h1>{team.name}</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>{data.round?.name || "Proxima jornada"}</span>
          <b>{data.round?.status || "Sin calendario"}</b>
          {!!leagues.length && (
            <select value={activeLeagueId} onChange={(e) => { const leagueId = Number(e.target.value); setActiveLeagueId(leagueId); load(leagueId); }}>
              {leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
        <aside>
          <article><small>PUNTOS TOTALES</small><strong>{team.total_points}</strong></article>
          <article><small>PRESUPUESTO</small><strong>{money(team.budget)}</strong></article>
          <article><small>VALOR PLANTILLA</small><strong>{money(team.teamValue)}</strong></article>
          <article><small>JUGADORES</small><strong>{team.squad.length}/24</strong></article>
        </aside>
      </section>
      {error && <p className="apex-error" style={{ color: "#a21d2b" }}>{error}</p>}

      {tab === "equipo" && <>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <label>Formacion <select value={formation} onChange={(e) => setFormation(e.target.value)}>{["4-4-2", "4-3-3", "3-5-2", "3-4-3", "5-3-2"].map((f) => <option key={f}>{f}</option>)}</select></label>
          <button disabled={busy} onClick={() => action("lineup", { formation, starters, captain })}>Guardar alineacion</button>
        </div>
        <section className="apex-bench" style={{ marginTop: 0 }}>
          <div><h2>Plantilla</h2><span>Selecciona 11 titulares y un capitan</span></div>
          <aside style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
            {team.squad.map((p) => <article key={p.id} style={{ minHeight: 180, opacity: starters.includes(p.id) ? 1 : 0.68 }}>
              <img src={p.photo} alt="" width="58" height="58" style={{ objectFit: "contain" }} />
              <strong>{p.name}</strong><small>{p.position} · {p.last_round_points} pts</small>
              <button onClick={() => setStarters((list) => list.includes(p.id) ? list.filter((id) => id !== p.id) : list.length < 11 ? [...list, p.id] : list)}>{starters.includes(p.id) ? "Titular" : "Suplente"}</button>
              {starters.includes(p.id) && <label><input type="radio" name="captain" checked={captain === p.id} onChange={() => setCaptain(p.id)} /> Capitan</label>}
            </article>)}
            {team.squad.length < 24 && <article className="add" onClick={() => setTab("mercado")}><UserPlus /><small>FICHAR</small></article>}
          </aside>
        </section>
      </>}

      {tab === "mercado" && <section>
        <p><b>Nuevo mercado en {Math.max(1, Math.ceil((data.market.refreshAt - Date.now()) / 3600000))} horas</b> · Refresco diario a las 00:00 ({data.market.timezone}).</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador" /></label>
          <select value={position} onChange={(e) => setPosition(e.target.value)}>{["TODOS", "POR", "DEF", "MED", "DEL"].map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="apex-challenge-grid">
          {market.map((p) => <article className="apex-challenge-card" key={p.id} style={{ display: "grid", gridTemplateColumns: "58px 1fr auto", gap: 12, alignItems: "center" }}>
            <img src={p.photo} alt="" width="58" height="58" />
            <div><strong>{p.name}</strong><small style={{ display: "block" }}>{p.team_name} · {p.position}</small><span>{p.total_points} pts · <TrendingUp size={13} /> {money(p.price)}</span></div>
            <button disabled={busy} onClick={() => action(owned.has(p.id) ? "sell" : "buy", { playerId: p.id })}>{owned.has(p.id) ? "Vender" : "Fichar"}</button>
          </article>)}
        </div>
        {!market.length && <div className="apex-empty-card"><strong>No hay jugadores disponibles en el mercado de hoy.</strong></div>}
      </section>}

      {tab === "ranking" && <section className="apex-league-ranking">
        <h2>Ranking de la liga</h2>
        {data.rankings.map((row, index) => <article key={`${row.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", padding: 14, borderBottom: "1px solid #d8dfdb" }}><b>{index + 1}</b><span>{row.name}</span><strong>{row.total_points} pts</strong></article>)}
      </section>}

      {tab === "ligas" && <Leagues leagues={leagues} busy={busy} action={action} activeLeagueId={activeLeagueId} setActiveLeagueId={setActiveLeagueId} load={load} />}
      <small style={{ display: "block", marginTop: 24 }}>ESPN · Plantillas: {syncStamp(data.usage.playersUpdatedAt)} · Resultados: {syncStamp(data.usage.resultsUpdatedAt)}.</small>
    </div>
  );
}

function Leagues({ leagues, busy, action, activeLeagueId, setActiveLeagueId, load }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return <section>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la liga" />
      <button disabled={busy || !name.trim()} onClick={() => action("league", { name })}><Users size={16} /> Crear liga</button>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codigo de invitacion" />
      <button disabled={busy || !code.trim()} onClick={() => action("join", { code })}>Unirme</button>
    </div>
    <div className="apex-challenge-grid">{leagues.map((league) => <article className="apex-challenge-card" key={league.id}><h3>{league.name}</h3><p>Codigo: <b>{league.code}</b></p><small>{league.members} miembros</small><button disabled={busy || activeLeagueId === league.id} onClick={() => { setActiveLeagueId(league.id); load(league.id); }}>Entrar</button></article>)}</div>
  </section>;
}
