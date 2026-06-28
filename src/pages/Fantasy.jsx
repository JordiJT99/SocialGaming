import { useEffect, useMemo, useState } from "react";
import { Clock3, Grip, Search, Shield, Trophy, TrendingUp, UserPlus, Users, Wallet, X } from "lucide-react";

const money = (value) => `${(Number(value || 0) / 1000000).toFixed(1)}M`;
const headers = (user, leagueId) => ({
  "content-type": "application/json",
  "x-playfulbet-user": user?.id || "current_user",
  "x-playfulbet-fantasy-league": String(leagueId || 1),
});
const syncStamp = (value) => value ? new Date(value).toLocaleString("es-ES") : "pendiente";
const trend = (price, previousPrice) => Number(price || 0) - Number(previousPrice || 0);
const FORMATIONS = {
  "4-4-2": { DEF: 4, MED: 4, DEL: 2 },
  "4-3-3": { DEF: 4, MED: 3, DEL: 3 },
  "3-5-2": { DEF: 3, MED: 5, DEL: 2 },
  "3-4-3": { DEF: 3, MED: 4, DEL: 3 },
  "5-3-2": { DEF: 5, MED: 3, DEL: 2 },
};

const shortName = (name = "") => {
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
};

const fixtureKickoff = (round) => {
  const time = round?.starts_at;
  if (!time) return "Sin fecha";
  return new Date(time).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const buildSlotSpec = (formation) => {
  const shape = FORMATIONS[formation] || FORMATIONS["4-3-3"];
  return [
    { row: "DEL", label: "DEL" }, { row: "DEL", label: "DEL" }, { row: "DEL", label: "DEL" },
    { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" },
    { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" },
    { row: "POR", label: "POR" },
  ].filter((slot, index) => {
    if (slot.row === "DEL") return index < shape.DEL;
    if (slot.row === "MED") return index >= 3 && index < 3 + shape.MED;
    if (slot.row === "DEF") return index >= 8 && index < 8 + shape.DEF;
    return true;
  });
};

const normalizeLayout = (layout, formation, squadIds = []) => {
  const slots = buildSlotSpec(formation);
  const valid = new Set(squadIds.map(Number));
  const seen = new Set();
  return slots.map((_, index) => {
    const value = Number(layout?.[index]);
    if (!value || !valid.has(value) || seen.has(value)) return null;
    seen.add(value);
    return value;
  });
};

const playerFitsSlot = (player, slot) => player?.position === slot?.row;

function SlotCard({ slot, player, isCaptain, onRemove, onCaptain, onDrop, onDragStart }) {
  return (
    <article className={`fantasy-hub-player ${player ? "is-selected" : "is-empty"}`}>
      <div
        className="fantasy-hub-player-card"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(slot.index, event.dataTransfer.getData("text/plain"));
        }}
      >
        {player ? (
          <>
            <button type="button" className="fantasy-hub-player-remove" onClick={() => onRemove(slot.index)}><X size={14} /></button>
            <button
              type="button"
              className="fantasy-hub-player-drag"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({ playerId: player.id, fromSlot: slot.index }));
                onDragStart?.(slot.index);
              }}
            >
              <Grip size={14} />
            </button>
            <img src={player.photo} alt="" />
            <strong>{shortName(player.name)}</strong>
            <small>{money(player.price)}</small>
          </>
        ) : (
          <>
            <span><UserPlus size={18} /></span>
            <strong>{slot.label}</strong>
            <small>Hueco libre</small>
          </>
        )}
      </div>
      {player && (
        <label className="fantasy-hub-captain">
          <input type="radio" name="fantasy-captain" checked={isCaptain} onChange={() => onCaptain(player.id)} />
          CAP
        </label>
      )}
    </article>
  );
}

function BenchCard({ player, onAdd }) {
  return (
    <article className="fantasy-hub-player">
      <div
        className="fantasy-hub-player-card"
        draggable
        onDragStart={(event) => event.dataTransfer.setData("text/plain", JSON.stringify({ playerId: player.id, fromSlot: null }))}
      >
        <img src={player.photo} alt="" />
        <strong>{shortName(player.name)}</strong>
        <small>{money(player.price)}</small>
      </div>
      <button type="button" className="fantasy-hub-bench-action" onClick={() => onAdd(player.id)}>Al campo</button>
    </article>
  );
}

export default function Fantasy({ user }) {
  const [tab, setTab] = useState("equipo");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("TODOS");
  const [formation, setFormation] = useState("4-3-3");
  const [captain, setCaptain] = useState(null);
  const [activeLeagueId, setActiveLeagueId] = useState(1);
  const [layout, setLayout] = useState([]);

  const applyPayload = (payload, fallbackLeagueId = 1) => {
    setData(payload);
    setActiveLeagueId(payload.activeLeagueId || fallbackLeagueId || 1);
    if (payload.team) {
      const squadIds = payload.team.squad.map((player) => player.id);
      setFormation(payload.team.formation);
      setCaptain(payload.team.squad.find((p) => p.is_captain)?.id || null);
      setLayout(normalizeLayout(payload.team.lineup_layout || payload.team.squad.filter((p) => p.is_starter).map((p) => p.id), payload.team.formation, squadIds));
    } else {
      setCaptain(null);
      setLayout([]);
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

  const team = data?.team;
  const leagues = data?.leagues || [];
  const squad = team?.squad || [];
  const squadMap = new Map(squad.map((player) => [player.id, player]));
  const slots = buildSlotSpec(formation).map((slot, index) => ({ ...slot, index }));
  const starters = layout.filter(Boolean);
  const starterSet = new Set(starters);
  const benchPlayers = squad.filter((player) => !starterSet.has(player.id));
  const market = useMemo(() => (data?.players || []).filter((p) =>
    (position === "TODOS" || p.position === position) && p.name.toLowerCase().includes(query.toLowerCase()),
  ), [data?.players, position, query]);
  const owned = new Set(squad.map((p) => p.id));
  const askBid = (player) => {
    const raw = window.prompt(`Puja secreta para ${player.name}`, String(player.price));
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return setError("La puja no es valida");
    action("bid", { playerId: player.id, amount });
  };
  const askOffer = (player) => {
    const raw = window.prompt(`Oferta directa para ${player.name}`, String(player.clause_amount || player.price || 0));
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return setError("La oferta no es valida");
    action("offer", { playerId: player.id, amount });
  };

  const reshapeLayout = (nextFormation) => {
    const squadIds = squad.map((player) => player.id);
    const normalized = normalizeLayout(layout, nextFormation, squadIds);
    const remaining = squad.filter((player) => !normalized.includes(player.id));
    const filled = normalized.map((value) => value || remaining.shift()?.id || null);
    setFormation(nextFormation);
    setLayout(filled);
  };

  const movePlayer = (targetIndex, rawPayload) => {
    try {
      const payload = JSON.parse(rawPayload || "{}");
      const playerId = Number(payload.playerId);
      const fromSlot = Number.isInteger(payload.fromSlot) ? Number(payload.fromSlot) : null;
      if (!playerId) return;
      setLayout((current) => {
        const next = [...current];
        const player = squadMap.get(playerId);
        const targetSlot = slots[targetIndex];
        if (!playerFitsSlot(player, targetSlot)) return current;
        const sourceIndex = fromSlot ?? next.findIndex((value) => value === playerId);
        if (sourceIndex >= 0) {
          const displaced = squadMap.get(next[targetIndex]);
          if (displaced && !playerFitsSlot(displaced, slots[sourceIndex])) return current;
          next[sourceIndex] = next[targetIndex] || null;
        }
        next[targetIndex] = playerId;
        return next;
      });
    } catch {}
  };

  const removeFromSlot = (slotIndex) => {
    setLayout((current) => current.map((value, index) => index === slotIndex ? null : value));
  };

  const addToField = (playerId) => {
    setLayout((current) => {
      const next = [...current];
      const player = squadMap.get(playerId);
      const emptyIndex = next.findIndex((value, index) => !value && playerFitsSlot(player, slots[index]));
      if (emptyIndex === -1) return current;
      next[emptyIndex] = playerId;
      return next;
    });
  };

  if (!data) return <div className="apex-page"><p>{error || "Cargando Fantasy..."}</p></div>;

  if (!team || squad.length === 0) {
    return (
      <div className="apex-page fantasy-hub-page">
        <section className="fantasy-hub-empty">
          <Shield size={42} />
          <div>
            <h1>Crea tu equipo Fantasy</h1>
            <p>Elige la liga y genera tu plantilla inicial para empezar a competir.</p>
          </div>
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
  }

  const insightFixtures = (data.round?.fixtures || []).slice(0, 4);

  return (
    <div className="apex-page fantasy-hub-page">
      <header className="fantasy-hub-topbar">
        <nav className="fantasy-hub-tabs">
          {[["equipo", "Mi equipo"], ["mercado", "Mercado"], ["ranking", "Ranking"], ["historial", "Historial"], ["ligas", "Ligas"]].map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div className="fantasy-hub-controls">
          {!!leagues.length && (
            <select value={activeLeagueId} onChange={(e) => { const leagueId = Number(e.target.value); setActiveLeagueId(leagueId); load(leagueId); }}>
              {leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <section className="fantasy-hub-stats">
        <article><small>MI PUNTUACION</small><strong>{team.total_points}</strong><span><Trophy size={14} /> {team.round_points} esta jornada</span></article>
        <article><small>PRESUPUESTO</small><strong>{money(team.budget)}</strong><span><Wallet size={14} /> saldo libre</span></article>
        <article><small>VALOR PLANTILLA</small><strong>{money(team.teamValue)}</strong><span><TrendingUp size={14} /> {squad.length}/24 jugadores</span></article>
        <article><small>PROXIMA JORNADA</small><strong>{fixtureKickoff(data.round)}</strong><span><Clock3 size={14} /> {data.round?.status || "Sin calendario"}</span></article>
      </section>

      {error && <p className="apex-error" style={{ color: "#a21d2b" }}>{error}</p>}
      {team.currentSnapshot && !team.currentSnapshot.can_score && <p className="apex-error" style={{ color: "#a21d2b" }}>Esta jornada no puntuas porque empezaste en saldo negativo.</p>}

      {tab === "equipo" && (
        <>
          <section className="fantasy-hub-main">
            <div className="fantasy-hub-pitch-card">
              <div className="fantasy-hub-panel-head">
                <div>
                  <h1>{team.name}</h1>
                  <p>{data.round?.name || "Proxima jornada"} · {formation}</p>
                </div>
                <div className="fantasy-hub-lineup-actions">
                  <label>Formacion
                    <select value={formation} onChange={(e) => reshapeLayout(e.target.value)}>
                      {Object.keys(FORMATIONS).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <button disabled={busy || starters.length !== 11 || !captain} onClick={() => action("lineup", { formation, starters, captain, layout })}>Guardar</button>
                </div>
              </div>

              <div className="fantasy-hub-pitch">
                <div className="fantasy-hub-pitch-lines" />
                {["DEL", "MED", "DEF", "POR"].map((row) => (
                  <div key={row} className={`fantasy-hub-row ${row.toLowerCase()}`}>
                    {slots.filter((slot) => slot.row === row).map((slot) => (
                      <SlotCard
                        key={slot.index}
                        slot={slot}
                        player={squadMap.get(layout[slot.index])}
                        isCaptain={captain === layout[slot.index]}
                        onRemove={removeFromSlot}
                        onCaptain={setCaptain}
                        onDrop={movePlayer}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="fantasy-hub-bench">
                <h3>Banquillo</h3>
                <div className="fantasy-hub-bench-list">
                  {benchPlayers.map((player) => <BenchCard key={player.id} player={player} onAdd={addToField} />)}
                </div>
              </div>
            </div>

            <aside className="fantasy-hub-market-card">
              <div className="fantasy-hub-panel-head">
                <div><h2>Mercado</h2><p>Refresco diario · {syncStamp(data.usage.playersUpdatedAt)}</p></div>
              </div>
              <div className="fantasy-hub-market-filters">
                <label><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugadores..." /></label>
                <select value={position} onChange={(e) => setPosition(e.target.value)}>
                  {["TODOS", "POR", "DEF", "MED", "DEL"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="fantasy-hub-market-list">
                {market.slice(0, 8).map((player) => (
                  <article key={player.id} className="fantasy-hub-market-item">
                    <img src={player.photo} alt="" />
                    <div><strong>{player.name}</strong><small>{player.position} · {player.team_name}</small></div>
                    <div className="fantasy-hub-market-side">
                      <b>{money(player.price)}</b>
                      <button disabled={busy} onClick={() => owned.has(player.id) ? action("sell", { playerId: player.id }) : askBid(player)}>{owned.has(player.id) ? "Vender" : "Pujar"}</button>
                    </div>
                  </article>
                ))}
                {!market.length && <div className="apex-empty-card"><strong>No hay jugadores disponibles.</strong></div>}
              </div>
            </aside>
          </section>

          <section className="fantasy-hub-insights">
            {insightFixtures.map((fixture) => (
              <article key={fixture.id}>
                <small>{fixture.league || "PROXIMO PARTIDO"}</small>
                <strong>{fixture.home?.name} vs {fixture.away?.name}</strong>
                <span>{new Date(fixture.date).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </article>
            ))}
          </section>
        </>
      )}

      {tab === "mercado" && (
        <section className="fantasy-hub-full-panel">
          <div className="fantasy-hub-panel-head"><div><h2>Mercado completo</h2><p>{market.length} jugadores visibles</p></div></div>
          <div className="fantasy-hub-market-filters">
            <label><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugadores..." /></label>
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              {["TODOS", "POR", "DEF", "MED", "DEL"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="fantasy-hub-market-table">
            {market.map((player) => (
              <article key={player.id} className="fantasy-hub-market-item">
                <img src={player.photo} alt="" />
                <div><strong>{player.name}</strong><small>{player.position} · {player.team_name}</small></div>
                <div className="fantasy-hub-market-side">
                  <b>{money(player.price)}</b>
                  <button disabled={busy} onClick={() => owned.has(player.id) ? action("sell", { playerId: player.id }) : askBid(player)}>{owned.has(player.id) ? "Vender" : "Pujar"}</button>
                </div>
              </article>
            ))}
          </div>
          {!!data.bids?.length && (
            <div className="fantasy-hub-market-table">
              <h3>Pujas abiertas</h3>
              {data.bids.map((bid) => (
                <article key={bid.id} className="fantasy-hub-market-item">
                  <div><strong>{bid.player_name}</strong><small>{bid.position} · {bid.team_name}</small></div>
                  <div className="fantasy-hub-market-side"><b>{money(bid.amount)}</b><small>Pendiente</small></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "ranking" && (
        <section className="fantasy-hub-full-panel">
          <div className="fantasy-hub-panel-head"><div><h2>Ranking de la liga</h2><p>{leagues.find((item) => item.id === activeLeagueId)?.name || "Liga activa"}</p></div></div>
          <div className="fantasy-hub-ranking-list">
            {data.rankings.map((row, index) => <article key={`${row.name}-${index}`}><b>{index + 1}</b><span>{row.name}</span><small>{money(row.team_value)}</small><strong>{row.total_points} pts</strong></article>)}
          </div>
          {!!data.rivalPlayers?.length && (
            <div className="fantasy-hub-market-table">
              <h3>Clausulazos disponibles</h3>
              {data.rivalPlayers.map((player) => (
                <article key={player.id} className="fantasy-hub-market-item">
                  <img src={player.photo} alt="" />
                  <div><strong>{player.name}</strong><small>{player.position} · {player.owner_name}</small></div>
                  <div className="fantasy-hub-market-side">
                    <b>{money(player.clause_amount)}</b>
                    <button disabled={busy} onClick={() => askOffer(player)}>Ofertar</button>
                    <button disabled={busy} onClick={() => action("clause-buyout", { playerId: player.id })}>Pagar clausula</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!!data.incomingOffers?.length && (
            <div className="fantasy-hub-market-table">
              <h3>Ofertas recibidas</h3>
              {data.incomingOffers.map((offer) => (
                <article key={offer.id} className="fantasy-hub-market-item">
                  <div><strong>{offer.player_name}</strong><small>{offer.position} · {offer.from_team}</small></div>
                  <div className="fantasy-hub-market-side">
                    <b>{money(offer.amount)}</b>
                    <button disabled={busy} onClick={() => action("offer-response", { offerId: offer.id, accept: true })}>Aceptar</button>
                    <button disabled={busy} onClick={() => action("offer-response", { offerId: offer.id, accept: false })}>Rechazar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!!data.outgoingOffers?.length && (
            <div className="fantasy-hub-market-table">
              <h3>Ofertas enviadas</h3>
              {data.outgoingOffers.map((offer) => (
                <article key={offer.id} className="fantasy-hub-market-item">
                  <div><strong>{offer.player_name}</strong><small>{offer.position} · {offer.to_team}</small></div>
                  <div className="fantasy-hub-market-side"><b>{money(offer.amount)}</b><small>Pendiente</small></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "historial" && (
        <section className="fantasy-hub-full-panel">
          <div className="fantasy-hub-panel-head"><div><h2>Historial de operaciones</h2><p>Movimientos y cambios de precio</p></div></div>
          <div className="fantasy-hub-market-table">
            {(data.history || []).map((item) => (
              <article key={item.id} className="fantasy-hub-market-item">
                <div>
                  <strong>{item.player_name}</strong>
                  <small>{item.operation} · {item.from_user_id || "mercado"} → {item.to_user_id || "mercado"}</small>
                </div>
                <div className="fantasy-hub-market-side">
                  <b>{money(item.price)}</b>
                  <small>{new Date(item.created_at).toLocaleString("es-ES")}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="fantasy-hub-market-table">
            <h3>Tendencia de plantilla</h3>
            {squad.map((player) => (
              <article key={player.id} className="fantasy-hub-market-item">
                <div><strong>{player.name}</strong><small>{player.position} · {player.team_name}</small></div>
                <div className="fantasy-hub-market-side">
                  <b>{money(player.price)}</b>
                  <small>{trend(player.price, player.previous_price) >= 0 ? "+" : ""}{money(trend(player.price, player.previous_price))}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "ligas" && <Leagues leagues={leagues} activeLeague={data.activeLeague} settings={data.settings} busy={busy} action={action} activeLeagueId={activeLeagueId} setActiveLeagueId={setActiveLeagueId} load={load} />}
      <small className="fantasy-hub-sync">ESPN · Plantillas: {syncStamp(data.usage.playersUpdatedAt)} · Resultados: {syncStamp(data.usage.resultsUpdatedAt)}.</small>
    </div>
  );
}

function Leagues({ leagues, activeLeague, settings: activeSettings, busy, action, activeLeagueId, setActiveLeagueId, load }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [settings, setSettings] = useState({
    initial_budget: 100000000,
    initial_players: 12,
    market_refresh_hour: 0,
    max_squad_players: 24,
    clause_max_multiplier: 4,
    clause_block_hours: 24,
  });
  useEffect(() => {
    if (activeSettings) setSettings((current) => ({ ...current, ...activeSettings }));
  }, [activeSettings]);
  return (
    <section className="fantasy-hub-full-panel">
      <div className="fantasy-hub-panel-head"><div><h2>Ligas privadas</h2><p>Gestiona tus grupos y entra por codigo</p></div></div>
      <div className="fantasy-hub-league-actions">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la liga" />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codigo de invitacion" />
        <button disabled={busy || !code.trim()} onClick={() => action("join", { code })}>Unirme</button>
      </div>
      <div className="fantasy-hub-league-actions">
        <label>Presupuesto
          <input type="number" min="1000000" step="1000000" value={settings.initial_budget} onChange={(e) => setSettings((current) => ({ ...current, initial_budget: Number(e.target.value) || 0 }))} />
        </label>
        <label>Plantilla inicial
          <input type="number" min="11" max="24" value={settings.initial_players} onChange={(e) => setSettings((current) => ({ ...current, initial_players: Number(e.target.value) || 11 }))} />
        </label>
        <label>Mercado
          <input type="number" min="0" max="23" value={settings.market_refresh_hour} onChange={(e) => setSettings((current) => ({ ...current, market_refresh_hour: Number(e.target.value) || 0 }))} />
        </label>
        <label>Max plantilla
          <input type="number" min="11" max="30" value={settings.max_squad_players} onChange={(e) => setSettings((current) => ({ ...current, max_squad_players: Number(e.target.value) || 24 }))} />
        </label>
        <label>Max clausula
          <input type="number" min="1" max="8" step="0.5" value={settings.clause_max_multiplier} onChange={(e) => setSettings((current) => ({ ...current, clause_max_multiplier: Number(e.target.value) || 4 }))} />
        </label>
        <label>Bloqueo clausula
          <input type="number" min="0" max="168" value={settings.clause_block_hours} onChange={(e) => setSettings((current) => ({ ...current, clause_block_hours: Number(e.target.value) || 0 }))} />
        </label>
        <button disabled={busy || !name.trim()} onClick={() => action("league", { name, settings })}><Users size={16} /> Crear liga</button>
        {!!activeLeague?.isAdmin && <button disabled={busy} onClick={() => action("settings", { settings })}>Guardar reglas</button>}
      </div>
      <div className="fantasy-hub-league-grid">
        {leagues.map((league) => (
          <article key={league.id}>
            <div><h3>{league.name}</h3><p>Codigo: <b>{league.code}</b></p></div>
            <small>{league.members} miembros</small>
            <button disabled={busy || activeLeagueId === league.id} onClick={() => { setActiveLeagueId(league.id); load(league.id); }}>{activeLeagueId === league.id ? "Activa" : "Entrar"}</button>
          </article>
        ))}
      </div>
      {activeSettings && (
        <div className="fantasy-hub-league-grid">
          <article>
            <div><h3>Reglas activas</h3><p>Presupuesto: {money(activeSettings.initial_budget)} · Mercado: {String(activeSettings.market_refresh_hour).padStart(2, "0")}:00</p></div>
            <small>{activeSettings.initial_players} jugadores iniciales · max {activeSettings.max_squad_players} en plantilla · clausula {activeSettings.clause_max_multiplier}x</small>
          </article>
          {!!activeLeague?.isAdmin && (
            <article>
              <div><h3>Panel de administrador</h3><p>Codigo: <b>{activeLeague.code}</b></p></div>
              <small>{activeLeague.members} miembros · bloqueo clausula {activeSettings.clause_block_hours}h</small>
            </article>
          )}
          {!!activeLeague?.membersList?.length && (
            <article>
              <div><h3>Miembros</h3><p>{activeLeague.membersList.length} en la liga</p></div>
              <small>{activeLeague.membersList.map((item) => `${item.team_name} (${money(item.budget || 0)})`).join(" · ")}</small>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
