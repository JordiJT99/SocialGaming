import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleDollarSign, Clock3, Copy, Download, FileDown, Gift, Globe, Grip, Info, KeyRound, LineChart, Lock, MoreVertical, PlusCircle, Printer, Search, Shield, ShoppingCart, Sparkles, Trophy, TrendingUp, UserPlus, Users, Wallet, X } from "lucide-react";

const money = (value) => `${(Number(value || 0) / 1000000).toFixed(1)}M`;
const headers = (user, leagueId) => ({
  "content-type": "application/json",
  "x-playfulbet-fantasy-league": String(leagueId || 1),
});
const syncStamp = (value) => value ? new Date(value).toLocaleString("es-ES") : "pendiente";
const trend = (price, previousPrice) => Number(price || 0) - Number(previousPrice || 0);

const generatePriceHistory = (player) => {
  const current = Number(player?.price || 0);
  const previous = Number(player?.previous_price ?? current);
  if (!current) return [];
  const points = [];
  const days = 30;
  const delta = (current - previous) / days;
  let value = previous - delta * days;
  const now = Date.now();
  for (let i = 0; i <= days; i++) {
    const noise = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * (current * 0.012);
    const trendLine = previous + delta * i;
    const next = i === days ? current : Math.max(0, trendLine + noise);
    points.push({ date: new Date(now - (days - i) * 24 * 60 * 60 * 1000), value: Math.round(next) });
  }
  return points;
};

const PriceHistoryModal = ({ player, onClose }) => {
  const history = useMemo(() => generatePriceHistory(player), [player]);
  if (!player) return null;
  const min = Math.min(...history.map((p) => p.value));
  const max = Math.max(...history.map((p) => p.value));
  const padding = (max - min) * 0.15 || max * 0.1;
  const yMin = Math.max(0, min - padding);
  const yMax = max + padding;
  const W = 560;
  const H = 200;
  const stepX = history.length > 1 ? W / (history.length - 1) : 0;
  const points = history.map((p, i) => {
    const x = i * stepX;
    const y = H - ((p.value - yMin) / (yMax - yMin || 1)) * H;
    return { x, y, ...p };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;
  const current = points[points.length - 1]?.value ?? 0;
  const start = points[0]?.value ?? 0;
  const variation = current - start;
  const variationPct = start ? (variation / start) * 100 : 0;
  const isUp = variation >= 0;
  const minP = points.reduce((a, b) => a.value < b.value ? a : b, points[0]);
  const maxP = points.reduce((a, b) => a.value > b.value ? a : b, points[0]);

  return (
    <div className="fantasy-price-modal-overlay" onClick={onClose}>
      <div className="fantasy-price-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="fantasy-price-modal-head">
            <img src={player.photo} alt="" />
            <div>
              <strong>{player.name}</strong>
              <small>{player.position} · {player.team_name}</small>
            </div>
            <span className={`fantasy-price-modal-trend ${isUp ? "up" : "down"}`}>
              {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isUp ? "+" : ""}{money(variation)} ({isUp ? "+" : ""}{variationPct.toFixed(2)}%)
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
        </header>
        <div className="fantasy-price-modal-body">
          <div className="fantasy-price-modal-current">
            <small>Precio actual</small>
            <strong>{money(current)}</strong>
          </div>
          <div className="fantasy-price-modal-stats">
            <div><small>Máximo (30d)</small><strong>{money(maxP.value)}</strong></div>
            <div><small>Mínimo (30d)</small><strong>{money(minP.value)}</strong></div>
            <div><small>Variación</small><strong className={isUp ? "up" : "down"}>{isUp ? "+" : ""}{money(variation)}</strong></div>
          </div>
          <div className="fantasy-price-modal-chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="fantasy-price-modal-chart" preserveAspectRatio="none">
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((y) => (
                <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
              ))}
              <path d={areaD} fill="url(#priceGrad)" />
              <path d={pathD} fill="none" stroke={isUp ? "#10b981" : "#ef4444"} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {points.length > 0 && (
                <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={isUp ? "#10b981" : "#ef4444"} stroke="white" strokeWidth="2" />
              )}
            </svg>
            <div className="fantasy-price-modal-axis">
              <span>{points[0]?.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
              <span>Hoy</span>
            </div>
          </div>
        </div>
        <footer>
          <LineChart size={14} />
          <small>Histórico simulado de los últimos 30 días basado en la fluctuación real del mercado.</small>
        </footer>
      </div>
    </div>
  );
};
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

function SlotCard({ slot, player, isCaptain, onRemove, onCaptain, onDrop, onDragStart, onSelectPlayer }) {
  return (
    <article className={`fantasy-hub-player ${player ? "is-selected" : "is-empty"}`}>
      <div
        className="fantasy-hub-player-card"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(slot.index, event.dataTransfer.getData("text/plain"));
        }}
        onClick={() => player && onSelectPlayer?.(player)}
        role={player ? "button" : undefined}
        tabIndex={player ? 0 : undefined}
      >
        {player ? (
          <>
            <button type="button" className="fantasy-hub-player-remove" onClick={(e) => { e.stopPropagation(); onRemove(slot.index); }}><X size={14} /></button>
            <button
              type="button"
              className="fantasy-hub-player-drag"
              draggable
              onClick={(e) => e.stopPropagation()}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({ playerId: player.id, fromSlot: slot.index }));
                onDragStart?.(slot.index);
              }}
            >
              <Grip size={14} />
            </button>
            <span className={`fantasy-hub-player-pos pos-${player.position?.toLowerCase()}`}>{player.position}</span>
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

function BenchCard({ player, onAdd, onSelectPlayer }) {
  return (
    <article className="fantasy-hub-player">
      <div
        className="fantasy-hub-player-card"
        draggable
        onClick={() => onSelectPlayer?.(player)}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", JSON.stringify({ playerId: player.id, fromSlot: null }))}
        role="button"
        tabIndex={0}
      >
        <span className={`fantasy-hub-player-pos pos-${player.position?.toLowerCase()}`}>{player.position}</span>
        <img src={player.photo} alt="" />
        <strong>{shortName(player.name)}</strong>
        <small>{money(player.price)}</small>
      </div>
      <button type="button" className="fantasy-hub-bench-action" onClick={(e) => { e.stopPropagation(); onAdd(player.id); }}>Al campo</button>
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
  const [selectedPlayer, setSelectedPlayer] = useState(null);

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

  const addToSquadDirect = (player) => {
    if (!team || owned.has(player.id)) return;
    const cost = player.price || 0;
    if (team.budget < cost) {
      setError("Presupuesto insuficiente");
      return;
    }
    action("buy", { playerId: player.id });
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
                        onSelectPlayer={setSelectedPlayer}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="fantasy-hub-bench">
                <h3>Banquillo</h3>
                <div className="fantasy-hub-bench-list">
                  {benchPlayers.map((player) => <BenchCard key={player.id} player={player} onAdd={addToField} onSelectPlayer={setSelectedPlayer} />)}
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
        <FantasyMarket
          market={market}
          team={team}
          data={data}
          busy={busy}
          action={action}
          owned={owned}
          askBid={askBid}
          onAddToSquad={(player) => {
            addToSquadDirect(player);
          }}
        />
      )}

      {tab === "ranking" && (
        <FantasyRanking
          data={data}
          user={user}
          activeLeagueId={activeLeagueId}
          leagues={leagues}
          action={action}
          busy={busy}
          askOffer={askOffer}
        />
      )}

      {tab === "historial" && (
        <FantasyHistory
          data={data}
          team={team}
          squad={squad}
          activeLeague={data?.activeLeague}
          leagues={leagues}
        />
      )}

      {tab === "ligas" && <Leagues leagues={leagues} activeLeague={data.activeLeague} settings={data.settings} busy={busy} action={action} activeLeagueId={activeLeagueId} setActiveLeagueId={setActiveLeagueId} load={load} rankings={data?.rankings || []} />}
      <small className="fantasy-hub-sync">ESPN · Plantillas: {syncStamp(data.usage.playersUpdatedAt)} · Resultados: {syncStamp(data.usage.resultsUpdatedAt)}.</small>

      <PriceHistoryModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
}

function Leagues({ leagues, activeLeague, settings: activeSettings, busy, action, activeLeagueId, setActiveLeagueId, load, rankings = [] }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(20);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [publicLoaded, setPublicLoaded] = useState(false);
  const [tab, setTab] = useState("mine");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fantasy/public-leagues")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setPublicLeagues(data.leagues || []); setPublicLoaded(true); } })
      .catch(() => { if (!cancelled) setPublicLoaded(true); });
    return () => { cancelled = true; };
  }, [activeLeagueId, leagues.length]);

  const handleCreateLeague = () => {
    action("league", {
      name: name.trim() || (visibility === "public" ? "Liga pública" : "Liga privada"),
      is_public: visibility === "public" ? 1 : 0,
      description,
      max_members: maxMembers,
      settings,
    });
  };

  const handleJoinPublic = (publicLeague) => {
    action("join", { code: publicLeague.code });
  };
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

  const myUsername = (typeof window !== "undefined" && JSON.parse(localStorage.getItem("playfulbet_data") || "{}")?.users?.[0]?.username) || "current_user";
  const myRank = rankings.findIndex((r) => r.name === myUsername) + 1;
  const myPoints = rankings.find((r) => r.name === myUsername)?.total_points || 18420;
  const winRate = myPoints ? Math.min(100, Math.round((myPoints / 18420) * 68.4)) : 68.4;
  const totalLeaguesEarnings = (activeSettings?.initial_budget || 100000000) > 0 ? 3120 : 0;

  return (
    <div className="fantasy-leagues-page">
      <div className="fantasy-leagues-header">
        <h1>Competitive Circles</h1>
        <p>Manage your private communities, create custom prize pools, and climb the ranks against your inner circle.</p>
      </div>

      <div className="fantasy-leagues-cta">
        <div className="fantasy-leagues-cta-card is-create">
          <div className="fantasy-leagues-cta-icon">
            <PlusCircle size={22} />
          </div>
          <h3>Create a New League</h3>
          <p>Establish your own rules, invite friends, and set custom entry fees and prize distributions.</p>

          <div className="fantasy-leagues-cta-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de tu liga"
            />
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={handleCreateLeague}
            >
              Start League <ArrowRight size={16} />
            </button>
          </div>

          <div className="fantasy-leagues-cta-toggle">
            <button
              type="button"
              className={visibility === "public" ? "active" : ""}
              onClick={() => setVisibility("public")}
            >
              <Globe size={14} />
              <div>
                <strong>Pública</strong>
                <small>Visible para todo el mundo, cualquiera puede unirse</small>
              </div>
            </button>
            <button
              type="button"
              className={visibility === "private" ? "active" : ""}
              onClick={() => setVisibility("private")}
            >
              <Lock size={14} />
              <div>
                <strong>Privada</strong>
                <small>Solo con código de invitación</small>
              </div>
            </button>
          </div>

          <div className="fantasy-leagues-cta-extras">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve (opcional)"
              maxLength={200}
            />
            <label className="fantasy-leagues-cta-maxmembers">
              <small>Máx. miembros</small>
              <input
                type="number"
                min="2"
                max="100"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Math.max(2, Math.min(100, Number(e.target.value) || 20)))}
              />
            </label>
          </div>
        </div>

        <div className="fantasy-leagues-cta-card is-join">
          <div className="fantasy-leagues-cta-icon is-join">
            <KeyRound size={22} />
          </div>
          <h3>Join with Code</h3>
          <p>Received an invitation? Enter the unique 8-digit access code to enter the circle.</p>
          <div className="fantasy-leagues-cta-form">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LEAGUE-CODE-2024"
              maxLength={20}
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              onClick={() => action("join", { code })}
            >
              Join League
            </button>
          </div>
        </div>
      </div>

      {activeLeague && activeLeague.code && (
        <div className="fantasy-leagues-invite">
          <div className="fantasy-leagues-invite-icon">
            <KeyRound size={20} />
          </div>
          <div className="fantasy-leagues-invite-info">
            <strong>Comparte la liga "{activeLeague.name}"</strong>
            <small>Otros managers pueden unirse con este código de invitación</small>
          </div>
          <div className="fantasy-leagues-invite-code">
            <code>{activeLeague.code}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(activeLeague.code)}
              aria-label="Copiar código"
            >
              <Copy size={14} />
              Copiar
            </button>
          </div>
        </div>
      )}

      {activeLeague?.isAdmin && activeSettings && (
        <div className="fantasy-leagues-rules">
          <div className="fantasy-leagues-rules-head">
            <div>
              <Shield size={18} />
              <strong>Reglas de la liga</strong>
              <small>Configura cómo se juega en <b>{activeLeague.name}</b></small>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => action("settings", { settings })}
              className="apex-btn-primary"
            >
              Guardar reglas
            </button>
          </div>
          <div className="fantasy-leagues-rules-grid">
            <label>
              <span>Presupuesto inicial</span>
              <small>Coins que recibe cada manager al unirse</small>
              <input
                type="number"
                min="1000000"
                step="1000000"
                value={settings.initial_budget}
                onChange={(e) => setSettings((current) => ({ ...current, initial_budget: Number(e.target.value) || 0 }))}
              />
              <em>{money(settings.initial_budget)}</em>
            </label>
            <label>
              <span>Plantilla inicial</span>
              <small>Jugadores con los que se empieza</small>
              <input
                type="number"
                min="11"
                max="24"
                value={settings.initial_players}
                onChange={(e) => setSettings((current) => ({ ...current, initial_players: Number(e.target.value) || 11 }))}
              />
              <em>{settings.initial_players} jugadores</em>
            </label>
            <label>
              <span>Hora de mercado</span>
              <small>Cuándo se renueva el mercado</small>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.market_refresh_hour}
                onChange={(e) => setSettings((current) => ({ ...current, market_refresh_hour: Number(e.target.value) || 0 }))}
              />
              <em>{String(settings.market_refresh_hour).padStart(2, "0")}:00</em>
            </label>
            <label>
              <span>Máx. plantilla</span>
              <small>Tope de jugadores en el equipo</small>
              <input
                type="number"
                min="11"
                max="30"
                value={settings.max_squad_players}
                onChange={(e) => setSettings((current) => ({ ...current, max_squad_players: Number(e.target.value) || 24 }))}
              />
              <em>{settings.max_squad_players} jugadores</em>
            </label>
            <label>
              <span>Multiplicador cláusula (x)</span>
              <small>Lo que se puede subir sobre el base</small>
              <input
                type="number"
                min="1"
                max="8"
                step="0.5"
                value={settings.clause_max_multiplier}
                onChange={(e) => setSettings((current) => ({ ...current, clause_max_multiplier: Number(e.target.value) || 4 }))}
              />
              <em>{settings.clause_max_multiplier}x</em>
            </label>
            <label>
              <span>Bloqueo cláusula (h)</span>
              <small>Horas sin poder bajar la cláusula</small>
              <input
                type="number"
                min="0"
                max="168"
                value={settings.clause_block_hours}
                onChange={(e) => setSettings((current) => ({ ...current, clause_block_hours: Number(e.target.value) || 0 }))}
              />
              <em>{settings.clause_block_hours}h</em>
            </label>
          </div>
        </div>
      )}

      <div className="fantasy-leagues-tabs">
        <button
          type="button"
          className={tab === "mine" ? "active" : ""}
          onClick={() => setTab("mine")}
        >
          <Trophy size={14} />
          Mis ligas <span>{leagues.length}</span>
        </button>
        <button
          type="button"
          className={tab === "public" ? "active" : ""}
          onClick={() => setTab("public")}
        >
          <Globe size={14} />
          Explorar públicas <span>{publicLeagues.length}</span>
        </button>
      </div>

      {tab === "mine" && (
        <>
          <div className="fantasy-leagues-active-head">
            <h2>My Active Leagues</h2>
            <div className="fantasy-leagues-filter">
              <small>FILTER BY:</small>
              <select defaultValue="all">
                <option value="all">All Leagues</option>
                <option value="active">Active</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

      <div className="fantasy-leagues-table-wrap">
        <table className="fantasy-leagues-table">
          <thead>
            <tr>
              <th>LEAGUE NAME</th>
              <th>MEMBERS</th>
              <th>CURRENT RANK</th>
              <th>PRIZE POOL</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => {
              const status = league.id === activeLeagueId ? "in_progress" : "open";
              const statusLabel = status === "in_progress" ? "In Progress" : status === "finished" ? "Finished" : "Active";
              const statusType = status === "finished" ? "finished" : status === "in_progress" ? "active" : "active";
              const rank = league.id === activeLeagueId && myRank > 0 ? myRank : Math.floor(Math.random() * 20) + 1;
              const rankLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
              const prizePool = (league.members || 12) * 500;
              return (
                <tr key={league.id} className={league.id === activeLeagueId ? "is-active" : ""}>
                  <td>
                    <div className="fantasy-leagues-name">
                      <div className="fantasy-leagues-logo" style={{ background: gradientFor(league.id) }}>
                        {league.is_public ? <Globe size={16} /> : <Lock size={16} />}
                      </div>
                      <div className="fantasy-leagues-name-info">
                        <strong>{league.name}</strong>
                        <small>Created by {league.id === 1 ? "Sistema" : `Manager #${league.id}`}</small>
                        <div className="fantasy-leagues-name-tags">
                          <span className={`fantasy-leagues-visibility ${league.is_public ? "is-public" : "is-private"}`}>
                            {league.is_public ? <><Globe size={10} /> Pública</> : <><Lock size={10} /> Privada</>}
                          </span>
                          {league.code && (
                            <button
                              type="button"
                              className="fantasy-leagues-code-chip"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(league.code); }}
                              title="Copiar código de invitación"
                            >
                              <KeyRound size={11} />
                              {league.code}
                              <Copy size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="fantasy-leagues-members">
                      <Users size={14} />
                      <span><strong>{league.members || 0}</strong> / {league.max_members || 20}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`fantasy-leagues-rank is-${rank <= 3 ? "top" : "normal"}`}>{rankLabel}</span>
                  </td>
                  <td>
                    <strong className="fantasy-leagues-prize">${prizePool.toLocaleString("en-US")}</strong>
                  </td>
                  <td>
                    <span className={`fantasy-leagues-status is-${statusType}`}>
                      <span className="fantasy-leagues-status-dot" />
                      {statusLabel}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="fantasy-leagues-enter"
                      disabled={busy}
                      onClick={() => { setActiveLeagueId(league.id); load(league.id); }}
                    >
                      {league.id === activeLeagueId ? "Open" : "Enter"}
                      <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {leagues.length === 0 && (
              <tr>
                <td colSpan={6} className="fantasy-leagues-empty">
                  <Trophy size={32} />
                  <strong>Aún no estás en ninguna liga</strong>
                  <small>Crea una o únete con un código arriba.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="fantasy-leagues-pagination">
          <small>Showing {leagues.length} of {leagues.length} active leagues</small>
          <div>
            <button type="button" disabled>Previous</button>
            <button type="button" disabled>Next</button>
          </div>
        </div>
      </div>
        </>
      )}

      {tab === "public" && (
        <div className="fantasy-leagues-public">
          <div className="fantasy-leagues-public-head">
            <h2>Explore Public Leagues</h2>
            <small>Únete a ligas abiertas creadas por la comunidad</small>
          </div>
          {publicLoaded && publicLeagues.length === 0 && (
            <div className="fantasy-leagues-public-empty">
              <Globe size={36} />
              <strong>No hay ligas públicas todavía</strong>
              <small>Crea una liga pública y aparecerá aquí para que otros se unan.</small>
            </div>
          )}
          <div className="fantasy-leagues-public-list">
            {publicLeagues.map((pl) => {
              const myInLeague = leagues.some((l) => l.id === pl.id);
              return (
                <div key={pl.id} className="fantasy-leagues-public-card">
                  <div className="fantasy-leagues-public-card-head">
                    <div className="fantasy-leagues-logo" style={{ background: gradientFor(pl.id) }}>
                      <Globe size={16} />
                    </div>
                    <div>
                      <strong>{pl.name}</strong>
                      <small>{pl.description || "Liga abierta para todo el mundo"}</small>
                    </div>
                    <span className="fantasy-leagues-public-tag">Pública</span>
                  </div>
                  <div className="fantasy-leagues-public-card-stats">
                    <div>
                      <small>Miembros</small>
                      <strong>{pl.members} / {pl.max_members}</strong>
                    </div>
                    <div>
                      <small>Código</small>
                      <strong><code>{pl.code}</code></strong>
                    </div>
                    <div>
                      <small>Premio</small>
                      <strong>${((pl.points_cash_reward || 0) * (pl.members || 1)).toLocaleString("en-US")}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || myInLeague || pl.members >= pl.max_members}
                    onClick={() => handleJoinPublic(pl)}
                  >
                    {myInLeague ? "Ya estás dentro" : pl.members >= pl.max_members ? "Completa" : "Unirme"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="fantasy-leagues-stats">
        <div className="fantasy-leagues-stat-card">
          <TrendingUp size={20} />
          <div>
            <small>MONTHLY WIN RATE</small>
            <strong>{winRate.toFixed(1)}%</strong>
            <em>+2.1%</em>
          </div>
        </div>
        <div className="fantasy-leagues-stat-card">
          <Trophy size={20} />
          <div>
            <small>GLOBAL RANK</small>
            <strong>#{myRank > 0 ? myRank : "1,402"}</strong>
            <em>Top 1%</em>
          </div>
        </div>
        <div className="fantasy-leagues-stat-card">
          <CircleDollarSign size={20} />
          <div>
            <small>LEAGUE EARNINGS</small>
            <strong>${totalLeaguesEarnings.toLocaleString("en-US")}</strong>
            <em>+8.4%</em>
          </div>
        </div>
      </div>
    </div>
  );
}

const GRADIENTS = [
  "linear-gradient(135deg, #047857, #065f46)",
  "linear-gradient(135deg, #f59e0b, #b45309)",
  "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  "linear-gradient(135deg, #ef4444, #b91c1c)",
  "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  "linear-gradient(135deg, #ec4899, #be185d)",
  "linear-gradient(135deg, #14b8a6, #0f766e)",
  "linear-gradient(135deg, #f97316, #c2410c)",
];
function gradientFor(id) {
  return GRADIENTS[(Number(id) || 1) % GRADIENTS.length];
}

const OPERATION_META = {
  buy_market:    { label: "Compra",   color: "#d1fae5", text: "#047857", icon: ShoppingCart },
  sell_market:   { label: "Venta",    color: "#fef3c7", text: "#b45309", icon: TrendingUp },
  initial_assign:{ label: "Inicial",  color: "#e0e7ff", text: "#4338ca", icon: Sparkles },
  bid_win:       { label: "Puja",     color: "#d1fae5", text: "#047857", icon: Trophy },
  clause_buyout: { label: "Cláusula", color: "#fee2e2", text: "#b91c1c", icon: Shield },
  offer:         { label: "Oferta",   color: "#dbeafe", text: "#1e40af", icon: Gift },
};

function opMeta(op) {
  return OPERATION_META[op] || { label: op, color: "#f3f4f6", text: "#4b5563", icon: ShoppingCart };
}

function FantasyHistory({ data, team, squad, activeLeague, leagues = [] }) {
  const [operationFilter, setOperationFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const enriched = useMemo(() => {
    const history = (data?.history || []).map((h) => ({ ...h, _ts: Number(h.created_at) || 0 }));
    const ops = (squad || []).map((p, i) => ({
      id: `squad-${p.id}-${i}`,
      player_name: p.name,
      position: p.position,
      team_name: p.team_name,
      photo: p.photo,
      from_user_id: null,
      to_user_id: "current_user",
      operation: p.is_starter ? "initial_assign" : "buy_market",
      price: p.purchase_price || p.price || 0,
      created_at: data?.usage?.playersUpdatedAt || Date.now(),
      _ts: data?.usage?.playersUpdatedAt || Date.now(),
      _isSquad: true,
    }));
    return [...history, ...ops].sort((a, b) => b._ts - a._ts);
  }, [data?.history, squad, data?.usage?.playersUpdatedAt]);

  const filtered = enriched.filter((h) => {
    if (operationFilter !== "all" && !h.operation.includes(operationFilter) && opMeta(h.operation).label.toLowerCase() !== operationFilter) {
      if (operationFilter === "buy" && !["buy_market", "bid_win", "clause_buyout"].includes(h.operation)) return false;
      if (operationFilter === "sell" && h.operation !== "sell_market") return false;
      if (operationFilter === "rewards" && h.operation !== "initial_assign") return false;
    }
    if (operationFilter === "buy" && !["buy_market", "bid_win", "clause_buyout"].includes(h.operation)) return false;
    if (operationFilter === "sell" && h.operation !== "sell_market") return false;
    if (operationFilter === "rewards" && h.operation !== "initial_assign") return false;
    if (fromDate && new Date(h._ts) < new Date(fromDate)) return false;
    if (toDate && new Date(h._ts) > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const biggestSpend = enriched.reduce((max, h) => (h.price > (max?.price || 0) ? h : max), null);
  const totalTransfers = enriched.filter((h) => ["buy_market", "sell_market", "bid_win", "clause_buyout"].includes(h.operation)).length;
  const leagueBudget = (team?.budget || 0) + (squad || []).reduce((s, p) => s + (p.price || 0), 0);
  const maxBudget = 100000000;
  const capUsed = leagueBudget > 0 ? Math.min(100, Math.round((leagueBudget / maxBudget) * 100)) : 0;

  const formatAmount = (n) => {
    const abs = Math.abs(n || 0);
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${n.toLocaleString("en-US")}`;
    return `$${n.toFixed(2)}`;
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
  };

  return (
    <div className="fantasy-history-page">
      <div className="fantasy-history-header">
        <h1>Transaction History</h1>
        <div className="fantasy-history-tabs">
          {[
            { id: "all", label: "All" },
            { id: "buy", label: "Fichajes" },
            { id: "sell", label: "Sales" },
            { id: "rewards", label: "Rewards" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={operationFilter === t.id ? "active" : ""}
              onClick={() => { setOperationFilter(t.id); setPage(1); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="fantasy-history-actions">
          <button type="button" aria-label="Exportar">
            <Download size={16} />
          </button>
          <button type="button" aria-label="Imprimir">
            <Printer size={16} />
          </button>
        </div>
      </div>

      <div className="fantasy-history-filters">
        <div className="fantasy-history-filter">
          <small>Operation Type</small>
          <select value={operationFilter} onChange={(e) => { setOperationFilter(e.target.value); setPage(1); }}>
            <option value="all">All Operations</option>
            <option value="buy">Fichajes / Compras</option>
            <option value="sell">Ventas</option>
            <option value="clause_buyout">Cláusulas</option>
            <option value="initial_assign">Asignaciones iniciales</option>
            <option value="bid_win">Pujas ganadas</option>
          </select>
        </div>
        <div className="fantasy-history-filter">
          <small>Date Range</small>
          <div className="fantasy-history-date-range">
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            <span>→</span>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </div>
        </div>
        <button
          type="button"
          className="fantasy-history-apply"
          onClick={() => setPage(1)}
        >
          <span>▾</span> Apply Filters
        </button>
      </div>

      <div className="fantasy-history-balance">
        <small>LEAGUE BALANCE</small>
        <strong>$14.2M</strong>
        <em>+2.4M (Monthly)</em>
        <span className="fantasy-history-balance-bar"><i style={{ width: "68%" }} /></span>
      </div>

      <div className="fantasy-history-table-wrap">
        <div className="fantasy-history-table-head">
          <h2>Recent Transactions</h2>
          <div className="fantasy-history-table-tools">
            <button type="button" aria-label="Descargar"><FileDown size={15} /></button>
            <button type="button" aria-label="Imprimir"><Printer size={15} /></button>
          </div>
        </div>
        <div className="fantasy-history-table">
          <div className="fantasy-history-row is-head">
            <span>DATE &amp; TIME</span>
            <span>OPERATION</span>
            <span>TARGET PLAYER</span>
            <span>MANAGER</span>
            <span>AMOUNT</span>
            <span>STATUS</span>
            <span></span>
          </div>
          {paged.map((tx) => {
            const { date, time } = formatDate(tx._ts);
            const meta = opMeta(tx.operation);
            const Icon = meta.icon;
            const amountColor = ["sell_market", "initial_assign"].includes(tx.operation) ? "up" : "down";
            const amountSign = amountColor === "up" ? "+" : "−";
            return (
              <div key={tx.id} className="fantasy-history-row">
                <div className="fantasy-history-cell-date">
                  <strong>{date}</strong>
                  <small>{time}</small>
                </div>
                <div>
                  <span className="fantasy-history-op" style={{ background: meta.color, color: meta.text }}>
                    {meta.label.toUpperCase()}
                  </span>
                </div>
                <div className="fantasy-history-cell-player">
                  <img src={tx.photo} alt="" />
                  <div>
                    <strong>{tx.player_name}</strong>
                    {tx.position && <small>{tx.position} · {tx.team_name}</small>}
                  </div>
                </div>
                <div className="fantasy-history-cell-manager">
                  <strong>{tx.to_user_id === "current_user" ? "Tú" : (tx.to_user_id || "Mercado")}</strong>
                  {tx.from_user_id && tx.from_user_id !== "mercado" && <small>de {tx.from_user_id}</small>}
                </div>
                <div className={`fantasy-history-cell-amount is-${amountColor}`}>
                  <strong>{amountSign}{formatAmount(tx.price)}</strong>
                </div>
                <div>
                  <span className="fantasy-history-status is-completed">
                    <span className="fantasy-history-status-dot" />
                    Completed
                  </span>
                </div>
                <div>
                  <button type="button" className="fantasy-history-more" aria-label="Más opciones">
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {paged.length === 0 && (
            <div className="fantasy-history-empty">
              <Info size={24} />
              <strong>No hay transacciones con esos filtros.</strong>
              <small>Prueba ampliando el rango de fechas o cambiando el tipo de operación.</small>
            </div>
          )}
        </div>
        <div className="fantasy-history-footer">
          <small>Showing {paged.length === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results</small>
          <div className="fantasy-history-pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? "active" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            {totalPages > 5 && <span>…</span>}
            <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>→</button>
          </div>
        </div>
      </div>

      <div className="fantasy-history-stats">
        <div className="fantasy-history-stat-card">
          <div className="fantasy-history-stat-icon is-purple"><TrendingUp size={18} /></div>
          <div>
            <small>BIGGEST SPEND</small>
            <strong>{biggestSpend?.player_name || "—"}</strong>
            <em>{formatAmount(biggestSpend?.price || 0)}</em>
          </div>
        </div>
        <div className="fantasy-history-stat-card">
          <div className="fantasy-history-stat-icon is-amber"><Users size={18} /></div>
          <div>
            <small>TOTAL TRANSFERS</small>
            <strong>{totalTransfers}</strong>
            <em>This Week</em>
          </div>
        </div>
        <div className="fantasy-history-stat-card">
          <div className="fantasy-history-stat-icon is-pink"><FileDown size={18} /></div>
          <div>
            <small>LEAGUE CAP</small>
            <strong>{capUsed}%</strong>
            <em>Utilized</em>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketFormBars({ points = 0 }) {
  const heights = [0.3, 0.5, 0.7, 0.9, 1];
  return (
    <div className="fantasy-market-form">
      {heights.map((h, i) => (
        <span key={i} className={`fantasy-market-form-bar ${i === 4 ? "is-current" : ""}`} style={{ height: `${h * 100}%` }} />
      ))}
    </div>
  );
}

function FantasyMarket({ market, team, data, busy, action, owned, askBid, onAddToSquad }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("TODOS");
  const [view, setView] = useState("ALL PLAYERS");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const filtered = (market || []).filter((p) => {
    if (position !== "TODOS" && p.position !== position) return false;
    if (view === "WATCHLIST") return owned.has(p.id);
    if (query) {
      const q = normalize(query);
      if (!normalize(p.name).includes(q) && !normalize(p.team_name).includes(q)) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const remaining = team?.budget || 0;
  const squadValue = (team?.squad || []).reduce((s, p) => s + (p.price || 0), 0);
  const topGainer = market.reduce((best, p) => ((p.price - (p.previous_price || p.price)) > (best.price - (best.previous_price || best.price)) ? p : best), market[0] || {});
  const trendPct = topGainer.previous_price ? (((topGainer.price - topGainer.previous_price) / topGainer.previous_price) * 100).toFixed(1) : "0.0";
  const mySelection = (team?.squad || []).slice(0, 15);

  const viewModes = ["ALL PLAYERS", "WATCHLIST", "HOT PICKS"];

  return (
    <div className="fantasy-market-page">
      <div className="fantasy-market-budget-bar">
        <div>
          <small>REMAINING BUDGET</small>
          <strong>${(remaining / 1e6).toFixed(1)}M</strong>
        </div>
        <div className="fantasy-market-budget-squad">
          <small>SQUAD VALUE</small>
          <strong>${(squadValue / 1e6).toFixed(1)}M</strong>
        </div>
        <div className="fantasy-market-budget-meta">
          <small>{squadValue > 0 ? `${team.squad.length}/15 Players Signed` : "0/15 Players Signed"}</small>
        </div>
      </div>

      <div className="fantasy-market-searchbar">
        <Search size={16} />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search players by name…" />
      </div>

      <div className="fantasy-market-pos-pills">
        {["All", "QB", "RB", "WR", "TE", "DEF"].map((pos) => (
          <button
            key={pos}
            className={position === (pos === "All" ? "TODOS" : pos) ? "active" : ""}
            onClick={() => { setPosition(pos === "All" ? "TODOS" : pos); setPage(1); }}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="fantasy-market-table-wrap">
        <div className="fantasy-market-table">
          <div className="fantasy-market-table-head">
            <span>PLAYER</span>
            <span>CLUB</span>
            <span>FORM</span>
            <span>POINTS (LR)</span>
            <span>AVG PTS</span>
            <span>VALUE</span>
            <span>CHANGE</span>
            <span></span>
          </div>
          {paged.length === 0 && (
            <div className="fantasy-market-empty">
              <Info size={22} />
              <strong>No hay jugadores con esos filtros.</strong>
              <small>Prueba con otro deporte o limpia la búsqueda.</small>
            </div>
          )}
          {paged.map((player) => {
            const prev = player.previous_price || player.price;
            const diff = (player.price || 0) - prev;
            const diffPct = prev ? (diff / prev) * 100 : 0;
            const isOwned = owned.has(player.id);
            return (
              <div key={player.id} className={`fantasy-market-row ${isOwned ? "is-owned" : ""}`}>
                <div className="fantasy-market-cell-player">
                  <img src={player.photo} alt="" />
                  <div>
                    <strong>{player.name}</strong>
                    <small>
                      <span className={`fantasy-market-pos pos-${player.position?.toLowerCase()}`}>{player.position}</span>
                      {" "}{shortName(player.team_name)} · ${(player.price / 1e6).toFixed(1)}M
                    </small>
                  </div>
                </div>
                <div className="fantasy-market-cell-club">
                  <span className="fantasy-market-club-badge" />
                  <strong>{shortName(player.team_name)}</strong>
                </div>
                <div className="fantasy-market-cell-form">
                  <MarketFormBars points={player.last_round_points} />
                </div>
                <div className="fantasy-market-cell-points">
                  <strong>{player.last_round_points || 0}</strong>
                </div>
                <div className="fantasy-market-cell-avg">
                  <strong>{(player.last_5_avg_points || 0).toFixed(1)}</strong>
                </div>
                <div className="fantasy-market-cell-value">
                  <strong>${(player.price / 1e6).toFixed(1)}M</strong>
                </div>
                <div className="fantasy-market-cell-change">
                  <span className={diff >= 0 ? "up" : "down"}>
                    {diff >= 0 ? "+" : ""}{(diff / 1e6).toFixed(1)}M
                  </span>
                </div>
                <div className="fantasy-market-cell-action">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => isOwned ? action("sell", { playerId: player.id }) : onAddToSquad(player)}
                  >
                    {isOwned ? "SELL" : "BUY"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fantasy-market-footer">
        <span>Showing {paged.length} of {filtered.length} players</span>
        <div className="fantasy-market-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
            <button key={n} className={n === page ? "active" : ""} onClick={() => setPage(n)}>{n}</button>
          ))}
          {totalPages > 5 && <span>…</span>}
          <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>→</button>
        </div>
      </div>

      <aside className="fantasy-market-selection">
        <div className="fantasy-market-selection-head">
          <h3>My Selection</h3>
          <span className="fantasy-market-selection-count">{mySelection.length} / 15</span>
        </div>
        <div className="fantasy-market-selection-list">
          {mySelection.map((p) => (
            <div key={p.id} className="fantasy-market-selection-item">
              <span className={`fantasy-market-pos pos-${p.position?.toLowerCase()}`}>{p.position}</span>
              <div>
                <strong>{p.name}</strong>
                <small>{p.team_name} · ${(p.price / 1e6).toFixed(1)}M</small>
              </div>
            </div>
          ))}
          {mySelection.length === 0 && (
            <div className="fantasy-market-selection-empty">
              <PlusCircle size={20} />
              <strong>Empty Slot</strong>
              <small>Add a Forward</small>
            </div>
          )}
        </div>
        {mySelection.length > 0 && (
          <div className="fantasy-market-selection-total">
            <span>Expected Pts:</span>
            <strong>{mySelection.reduce((s, p) => s + (p.last_5_avg_points || 0), 0).toFixed(1)}</strong>
            <button type="button" className="apex-btn-primary">CONFIRM TEAM</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function FantasyRanking({ data, user, activeLeagueId, leagues, action, busy, askOffer }) {
  const [scope, setScope] = useState("GLOBAL");
  const [query, setQuery] = useState("");

  const rankings = data?.rankings || [];
  const top3 = rankings.slice(0, 3);
  const myUsername = user?.username || "current_user";
  const myRank = rankings.findIndex((r) => r.name === myUsername) + 1;
  const myRow = rankings.find((r) => r.name === myUsername);
  const myPoints = myRow?.total_points || 1842;
  const myRankDisplay = myRank > 0 ? myRank : 142;
  const myPos = "+12";
  const myPercentile = "Top 5%";
  const myMessage = `Keep pushing, ${myUsername}! You're in the top bracket of the Global League.`;

  const trendFor = (rank) => {
    if (rank === 1) return { text: "+ 0", type: "stable" };
    if (rank === 2) return { text: "+ 0", type: "stable" };
    if (rank === 3) return { text: "+ 0", type: "stable" };
    if (rank % 2 === 0) return { text: `+ ${(rank % 5) + 2}`, type: "up" };
    return { text: `– 0`, type: "down" };
  };

  const filtered = rankings.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return r.name?.toLowerCase().includes(q);
  });

  const avatarFor = (seed) => `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed || "user")}`;

  return (
    <div className="fantasy-ranking-page">
      <div className="fantasy-ranking-header">
        <h1>Fantasy Rankings</h1>
        <div className="fantasy-ranking-scope">
          {[{ id: "GLOBAL", label: "Global" }, { id: "FRIENDS", label: "Friends" }].map((t) => (
            <button key={t.id} className={scope === t.id ? "active" : ""} onClick={() => setScope(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {top3.length >= 3 && (
        <div className="fantasy-ranking-podium">
          <div className="fantasy-ranking-podium-card is-silver">
            <span className="fantasy-ranking-podium-medal is-silver">★ 2nd</span>
            <div className="fantasy-ranking-podium-avatar">
              <img src={avatarFor(top3[1]?.name || "ElenaD")} alt="" />
            </div>
            <strong>{top3[1]?.name || "Elena Rodriguez"}</strong>
            <small>{top3[1]?.team_name || "Real Dragons FC"}</small>
            <span className="fantasy-ranking-podium-pts">{(top3[1]?.total_points || 2140).toLocaleString("en-US")} pts</span>
          </div>
          <div className="fantasy-ranking-podium-card is-gold">
            <span className="fantasy-ranking-podium-medal is-gold">★ 1st</span>
            <div className="fantasy-ranking-podium-avatar">
              <img src={avatarFor(top3[0]?.name || "MarcusS")} alt="" />
            </div>
            <strong>{top3[0]?.name || "Marcus Sterling"}</strong>
            <small>{top3[0]?.team_name || "Apex Titans"}</small>
            <span className="fantasy-ranking-podium-pts">{(top3[0]?.total_points || 2385).toLocaleString("en-US")} pts</span>
            <span className="fantasy-ranking-podium-tag">WEEKLY CHAMPION</span>
          </div>
          <div className="fantasy-ranking-podium-card is-bronze">
            <span className="fantasy-ranking-podium-medal is-bronze">★ 3rd</span>
            <div className="fantasy-ranking-podium-avatar">
              <img src={avatarFor(top3[2]?.name || "JulianV")} alt="" />
            </div>
            <strong>{top3[2]?.name || "Julian Vane"}</strong>
            <small>{top3[2]?.team_name || "Red Devils Elite"}</small>
            <span className="fantasy-ranking-podium-pts">{(top3[2]?.total_points || 2098).toLocaleString("en-US")} pts</span>
          </div>
        </div>
      )}

      <div className="fantasy-ranking-myposition">
        <div className="fantasy-ranking-myposition-rank">
          <small>TU POSICIÓN</small>
          <strong>#{myRankDisplay}</strong>
        </div>
        <div className="fantasy-ranking-myposition-message">
          <p>{myMessage}</p>
        </div>
        <div className="fantasy-ranking-myposition-stats">
          <div>
            <small>Puntos<br />Totales</small>
            <strong>{myPoints.toLocaleString("en-US")}</strong>
          </div>
          <div>
            <small>Racha</small>
            <strong className="up">{myPos} Pos</strong>
          </div>
          <div>
            <small>Percentil</small>
            <strong>{myPercentile}</strong>
          </div>
        </div>
      </div>

      <div className="fantasy-ranking-leaderboard-head">
        <h2>Global Leaderboard</h2>
        <div className="fantasy-ranking-search">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search manager..." />
        </div>
      </div>

      <div className="fantasy-ranking-table-wrap">
        <table className="fantasy-ranking-table">
          <thead>
            <tr>
              <th>RANK</th>
              <th>MANAGER</th>
              <th>TEAM NAME</th>
              <th>TOTAL POINTS</th>
              <th>TREND</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(3, 20).map((row, index) => {
              const rank = index + 4;
              const trend = trendFor(rank);
              return (
                <tr key={`${row.name}-${index}`} className={row.name === myUsername ? "is-me" : ""}>
                  <td>
                    <span className="fantasy-ranking-rank-num">{String(rank).padStart(2, "0")}</span>
                  </td>
                  <td>
                    <div className="fantasy-ranking-user">
                      <img src={avatarFor(row.name)} alt="" />
                      <strong>
                        {row.name}
                        {row.name === myUsername && <em> (Tú)</em>}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <span className="fantasy-ranking-team">{row.team_name || `${row.name}'s XI`}</span>
                  </td>
                  <td>
                    <strong>{(row.total_points || 0).toLocaleString("en-US")}</strong>
                  </td>
                  <td>
                    <span className={`fantasy-ranking-trend is-${trend.type}`}>
                      {trend.text}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="fantasy-ranking-empty">
                  <Trophy size={28} />
                  <strong>No hay resultados</strong>
                  <small>Prueba con otro término de búsqueda.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rankings.length > 4 && (
        <div className="fantasy-ranking-view-more">
          <button type="button">View Full Rankings ›</button>
        </div>
      )}

      {data?.rivalPlayers?.length > 0 && (
        <div className="fantasy-ranking-rivals">
          <h2>Clausulazos disponibles</h2>
          <div className="fantasy-ranking-rivals-list">
            {data.rivalPlayers.slice(0, 5).map((player) => (
              <div key={player.id} className="fantasy-ranking-rival-item">
                <img src={player.photo} alt="" />
                <div>
                  <strong>{player.name}</strong>
                  <small>{player.position} · {player.team_name}</small>
                </div>
                <div className="fantasy-ranking-rival-side">
                  <b>{money(player.clause_amount)}</b>
                  <button disabled={busy} onClick={() => askOffer(player)}>Ofertar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
