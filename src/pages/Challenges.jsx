import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Copy, Flame, LockKeyhole, Medal, Plus, Trophy, Users } from "lucide-react";
import { createPorra, getPorras, joinPorra, resolvePorra, savePorraPrediction } from "../data/store";

function useCountdown(targetDate) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetDate - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetDate - Date.now()));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return remaining;
}

function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function PredictionForm({ porra, entry, onSubmit }) {
  const [predictions, setPredictions] = useState(entry?.predictions || {});
  const locked = porra.status !== "open";
  const complete = porra.matchIds.every((id) => predictions[id]?.homeScore !== "" && predictions[id]?.awayScore !== "" && predictions[id]?.homeScore != null && predictions[id]?.awayScore != null);

  return (
    <div className="apex-quiniela-list" style={{ marginTop: 12 }}>
      {porra.matches.map((match) => (
        <article className="apex-quiniela-row" key={match.id} style={{ gridTemplateColumns: "1fr 160px", alignItems: "center" }}>
          <div className="apex-quiniela-row-league">
            <span className="apex-quiniela-row-league-icon"><Trophy size={17} /></span>
            <div><strong>{match.home} vs {match.away}</strong><small>{match.league} · {new Date(match.date).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <input disabled={locked || !entry} type="number" min="0" value={predictions[match.id]?.homeScore ?? ""} onChange={(e) => setPredictions((p) => ({ ...p, [match.id]: { ...(p[match.id] || {}), homeScore: e.target.value } }))} style={{ width: 62, padding: "10px", border: "1px solid var(--apex-outline)", borderRadius: 8, textAlign: "center" }} />
            <input disabled={locked || !entry} type="number" min="0" value={predictions[match.id]?.awayScore ?? ""} onChange={(e) => setPredictions((p) => ({ ...p, [match.id]: { ...(p[match.id] || {}), awayScore: e.target.value } }))} style={{ width: 62, padding: "10px", border: "1px solid var(--apex-outline)", borderRadius: 8, textAlign: "center" }} />
          </div>
        </article>
      ))}
      {entry && !locked && <button className="primary-btn" disabled={!complete} onClick={() => onSubmit(predictions)}>Guardar prediccion</button>}
    </div>
  );
}

export default function Challenges({ store, sportsData, user, onStoreChange }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", entryCost: 50, visibility: "private", matchId: "" });
  const [error, setError] = useState("");

  const matches = sportsData.matches || [];
  const porras = useMemo(() => getPorras(store, matches), [store, matches]);
  const selected = porras.find((porra) => porra.id === selectedId) || porras[0];
  const entry = (store.porraEntries || []).find((item) => item.userId === "current_user" && item.porraId === selected?.id);
  const ranking = (store.porraEntries || [])
    .filter((item) => item.porraId === selected?.id)
    .sort((a, b) => (a.position || 999) - (b.position || 999) || new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
  const upcomingMatches = matches.filter((match) => ["upcoming", "scheduled"].includes(match.status)).slice(0, 40);
  const remaining = useCountdown(selected ? new Date(selected.registrationDeadline).getTime() : Date.now());

  const mutate = (fn) => {
    try {
      setError("");
      fn();
      onStoreChange?.();
    } catch (err) {
      setError(err.message || "No se pudo completar la accion");
    }
  };

  const create = () => mutate(() => {
    const porra = createPorra(store, form, matches);
    setSelectedId(porra.id);
    setShowCreate(false);
    setForm({ name: "", entryCost: 50, visibility: "private", matchId: "" });
  });

  const shareText = selected ? `${window.location.origin}/challenges?invite=${selected.inviteCode}` : "";

  return (
    <div className="product-page challenges-page">
      <header className="product-hero challenge-hero">
        <div><span className="product-eyebrow"><Flame size={15} /> Porras sociales</span><h1>Porras</h1><p>Crea una porra, invita amigos, predice marcadores y compite por un prize pool en coins.</p></div>
        <div className="challenge-countdown"><CalendarClock size={22} /><div><span>Cierre de la porra</span><strong>{formatCountdown(remaining)}</strong></div></div>
      </header>

      <div className="challenge-stats">
        <div><Trophy size={20} /><span>Porras activas</span><strong>{porras.filter((p) => p.status === "open").length}</strong></div>
        <div><Medal size={20} /><span>Prize pool</span><strong>{(selected?.finalPrizePool || 0).toLocaleString("es-ES")}</strong></div>
        <div><Users size={20} /><span>Participantes</span><strong>{selected?.participantsCount || 0}</strong></div>
      </div>

      {error && <div className="api-state error"><strong>{error}</strong></div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", margin: "0 0 18px" }}>
        <h2 className="apex-section-title" style={{ margin: 0 }}>Porras disponibles</h2>
        <button className="primary-btn" onClick={() => setShowCreate((v) => !v)}><Plus size={16} /> Crear porra</button>
      </div>

      {showCreate && (
        <section className="apex-sportsbook-help" style={{ marginBottom: 18, alignItems: "stretch" }}>
          <LockKeyhole size={18} />
          <div style={{ flex: 1, display: "grid", gap: 10 }}>
            <input placeholder="Nombre de la porra" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ padding: 12, border: "1px solid var(--apex-outline)", borderRadius: 8 }} />
            <select value={form.matchId} onChange={(e) => setForm((f) => ({ ...f, matchId: e.target.value }))} style={{ padding: 12, border: "1px solid var(--apex-outline)", borderRadius: 8 }}>
              <option value="">Selecciona partido</option>
              {upcomingMatches.map((match) => <option value={match.id} key={match.id}>{match.home} vs {match.away} · {match.league}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" min="0" value={form.entryCost} onChange={(e) => setForm((f) => ({ ...f, entryCost: e.target.value }))} style={{ width: 120, padding: 12, border: "1px solid var(--apex-outline)", borderRadius: 8 }} />
              <select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))} style={{ padding: 12, border: "1px solid var(--apex-outline)", borderRadius: 8 }}>
                <option value="private">Privada</option>
                <option value="public">Publica</option>
              </select>
              <button className="primary-btn" onClick={create}>Crear</button>
            </div>
          </div>
        </section>
      )}

      <div className="challenge-grid">
        {porras.map((porra) => {
          const isSelected = selected?.id === porra.id;
          const isJoined = (store.porraEntries || []).some((item) => item.userId === "current_user" && item.porraId === porra.id);
          return (
            <article className={`challenge-card ${porra.visibility === "private" ? "blue" : "green"}`} key={porra.id} onClick={() => setSelectedId(porra.id)} style={{ outline: isSelected ? "2px solid var(--apex-primary)" : "none" }}>
              <div className="challenge-top"><span>{porra.visibility === "private" ? "Privada" : "Publica"}</span><b>{porra.entryCost} coins</b></div>
              <div className="challenge-symbol">{porra.visibility === "private" ? <LockKeyhole /> : <Trophy />}</div>
              <h2>{porra.name}</h2><p>{porra.description || porra.league}</p>
              <div className="challenge-prize"><span>Prize pool</span><strong>{porra.finalPrizePool.toLocaleString("es-ES")} coins</strong></div>
              <div className="challenge-progress"><div><span>{porra.participantsCount} participantes</span><b>{porra.status}</b></div><div><i style={{ width: `${Math.min(100, porra.participantsCount * 10)}%` }} /></div></div>
              <button className={isJoined ? "joined" : ""} onClick={(e) => { e.stopPropagation(); mutate(() => joinPorra(store, porra)); }}>{isJoined ? <><Check size={15} /> Inscrito</> : <>Participar</>}</button>
            </article>
          );
        })}
      </div>

      {selected && (
        <section className="apex-history" style={{ marginTop: 24 }}>
          <div><h2>{selected.name}</h2><button type="button">{selected.status}</button></div>
          <article>
            <span><Copy size={18} /></span>
            <div><strong>Codigo {selected.inviteCode}</strong><small>{shareText}</small></div>
            <aside><b>{selected.finalPrizePool} coins</b><em>{selected.participantsCount} jugadores</em></aside>
          </article>
          {!entry && selected.status === "open" && <button className="primary-btn" onClick={() => mutate(() => joinPorra(store, selected))}>Participar por {selected.entryCost} coins</button>}
          {selected.status === "finished" && <button className="primary-btn" onClick={() => mutate(() => resolvePorra(store, selected, matches))}>Publicar resultados y pagar</button>}
          <PredictionForm porra={selected} entry={entry} onSubmit={(predictions) => mutate(() => savePorraPrediction(store, selected, predictions))} />
        </section>
      )}

      {selected && (
        <section className="apex-history">
          <div><h2>Ranking</h2><button type="button">{ranking.length} jugadores</button></div>
          {ranking.length ? ranking.map((row, index) => (
            <article key={row.id}>
              <span>{row.position || index + 1}</span>
              <div><strong>{row.userId === "current_user" ? user?.username || "Jordi" : row.userId}</strong><small>{row.points || 0} puntos · {row.exactScores || 0} exactos · {row.correctWinners || 0} ganadores</small></div>
              <aside><b>{row.status}</b><em>{row.prizeWon ? `+${row.prizeWon} coins` : "0 coins"}</em></aside>
            </article>
          )) : <article className="empty"><strong>Aun no hay participantes</strong></article>}
        </section>
      )}
    </div>
  );
}
