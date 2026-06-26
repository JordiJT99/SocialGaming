import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDollarSign, Coins, Info, LoaderCircle, Search, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";
import { getQuinielas, joinQuiniela, resolveQuiniela, saveUserQuiniela, deriveResult } from "../data/store";

const FILTERS = ["Todas", "LaLiga", "Champions", "Premier", "Activas", "Finalizadas"];

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name?.slice(0, 3).toUpperCase() || "???"}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

function MatchPick({ match, value, locked, onPick }) {
  const score = match.status === "finished" ? ` · ${match.score || deriveResult(match) || "finalizado"}` : "";
  return (
    <article className="apex-quiniela-row" style={{ gridTemplateColumns: "220px minmax(0, 1fr) 246px", alignItems: "center", columnGap: "16px" }}>
      <div className="apex-quiniela-row-league">
        <span className="apex-quiniela-row-league-icon"><Trophy size={17} /></span>
        <div><strong>{match.league || "Competicion"}</strong><small>{new Date(match.date).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{score}</small></div>
      </div>
      <div
        className="apex-quiniela-row-match"
        style={{ minWidth: 0, display: "grid", gridTemplateColumns: "84px minmax(100px, 1fr) 32px minmax(100px, 1fr) 84px", alignItems: "center", gap: "10px" }}
      >
        <div className="apex-quiniela-row-team" style={{ minWidth: 0, display: "contents" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Crest src={match.homeBadge} name={match.home} /></div>
          <span title={match.home} style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip", fontWeight: 700, lineHeight: 1.2 }}>{match.home}</span>
        </div>
        <span className="apex-quiniela-row-vs" style={{ textAlign: "center" }}>vs</span>
        <div className="apex-quiniela-row-team away" style={{ minWidth: 0, display: "contents" }}>
          <span title={match.away} style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip", fontWeight: 700, lineHeight: 1.2, textAlign: "right" }}>{match.away}</span>
          <div style={{ display: "flex", justifyContent: "center" }}><Crest src={match.awayBadge} name={match.away} /></div>
        </div>
      </div>
      <div className="apex-quiniela-row-market" style={{ display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
        <div className="apex-quiniela-row-odds">
          {["1", "X", "2"].map((pick) => (
            <button key={pick} type="button" disabled={locked} className={value === pick ? "selected" : ""} onClick={() => onPick(match.id, pick)}>
              <small>{pick === "1" ? "LOCAL" : pick === "X" ? "EMPATE" : "VISITA"}</small>
              <b>{pick}</b>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function Sportsbook({ sportsData, store, onStoreChange, user }) {
  const [filter, setFilter] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");

  const quinielas = useMemo(() => getQuinielas(store, sportsData.matches || []), [store, sportsData.matches]);
  const selected = quinielas.find((q) => q.id === selectedId) || quinielas[0];
  const userEntries = (store.userQuinielas || []).filter((q) => q.userId === "current_user" && q.quinielaId === selected?.id);
  const activeEntry = userEntries.find((e) => e.status === "draft") || userEntries[userEntries.length - 1] || null;
  const entryCount = userEntries.length;
  const selections = { ...(activeEntry?.selections || {}), ...draft };
  const locked = selected && selected.status !== "open";
  const done = selected?.matchIds.every((id) => ["1", "X", "2"].includes(selections[id]));
  const ranking = (store.userQuinielas || [])
    .filter((q) => q.quinielaId === selected?.id)
    .sort((a, b) => (a.position || 999) - (b.position || 999) || new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));

  const visible = quinielas.filter((q) => {
    const qText = `${q.name} ${q.league}`.toLowerCase();
    const textOk = !searchQuery || qText.includes(searchQuery.toLowerCase());
    const filterOk = filter === "Todas"
      || (filter === "Activas" && ["open", "in_progress"].includes(q.status))
      || (filter === "Finalizadas" && ["finished", "paid"].includes(q.status))
      || q.league.toLowerCase().includes(filter.toLowerCase());
    return textOk && filterOk;
  });

  const mutate = (fn) => {
    try {
      setError("");
      fn();
      onStoreChange?.();
      setDraft({});
    } catch (err) {
      setError(err.message || "No se pudo completar la accion");
    }
  };

  const handleParticipate = () => {
    if (!selected) return;
    if (activeEntry) {
      mutate(() => saveUserQuiniela(store, selected, selections));
    } else {
      mutate(() => joinQuiniela(store, selected));
    }
  };

  return (
    <div className="product-page sportsbook-page">
      <div className="apex-sportsbook-content">
        <header className="apex-sportsbook-hero">
          <div>
            <span className="apex-sportsbook-eyebrow"><ShieldCheck size={14} /> Coins virtuales · sin dinero real</span>
            <h1>Quiniela</h1>
            <p>Entra antes del cierre, paga la entrada en coins, marca 1/X/2 y compite por el prize pool acumulado.</p>
          </div>
          <div className="apex-sportsbook-hero-badge">
            <CircleDollarSign size={18} />
            <div><strong>{(user?.points || 0).toLocaleString("es-ES")} coins</strong><span>Saldo disponible</span></div>
          </div>
        </header>

        <div className="apex-eventos-sport-filter">
          {FILTERS.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>

        <div className="apex-event-search">
          <Search size={16} />
          <input className="apex-event-search-input" placeholder="Buscar quinielas o ligas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && <button type="button" className="apex-event-search-clear" onClick={() => setSearchQuery("")} aria-label="Limpiar"><X size={16} /></button>}
        </div>

        {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando quinielas</strong></div>}
        {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error al cargar partidos</strong><p>{sportsData.error}</p></div>}
        {error && <div className="api-state error"><AlertCircle size={20} /><strong>{error}</strong></div>}

        <section className="apex-eventos-section">
          <div className="apex-section-title">
            <h2>Quinielas disponibles</h2>
            <span className="apex-section-count">{visible.length}</span>
          </div>
          <div className="apex-quiniela-list">
            {visible.map((q) => (
              <button key={q.id} type="button" className="apex-quiniela-row" onClick={() => { setSelectedId(q.id); setDraft({}); }} style={{ textAlign: "left" }}>
                <div className="apex-quiniela-row-league">
                  <span className="apex-quiniela-row-league-icon"><Trophy size={17} /></span>
                  <div><strong>{q.name}</strong><small>{q.league} · Jornada {q.round}</small></div>
                </div>
                <div className="apex-quiniela-row-when"><span className="apex-quiniela-row-time">{q.status}</span></div>
                <div><strong>{q.participantsCount}</strong><small> participantes</small></div>
                <div><strong>{q.finalPrizePool}</strong><small> prize pool</small></div>
              </button>
            ))}
          </div>
          {!visible.length && !sportsData.loading && <div className="api-state"><Info size={24} /><strong>No hay quinielas para este filtro</strong></div>}
        </section>

        {selected && (
          <section className="apex-eventos-section">
            <div className="apex-section-title">
              <h2>{selected.name}</h2>
              <span className="apex-section-count">{selected.entryCost} coins · {selected.finalPrizePool} premio</span>
            </div>
            <div className="apex-quiniela-summary">
              <div className="apex-quiniela-summary-info">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Entrada: {selected.entryCost} coins</strong>
                  <p>Cierre: {new Date(selected.registrationDeadline).toLocaleString("es-ES")}. Tras el inicio se bloquean inscripciones y cambios.</p>
                </div>
              </div>
              {entryCount > 0 && (
                <span className="apex-quiniela-entry-count">
                  <Sparkles size={14} /> {entryCount} {entryCount === 1 ? "participación" : "participaciones"} tuyas
                </span>
              )}
            </div>

            {selected.matches.map((match) => (
              <MatchPick key={match.id} match={match} value={selections[match.id]} locked={locked} onPick={(id, pick) => setDraft((d) => ({ ...d, [id]: pick }))} />
            ))}

            {!locked && (
              <div className="apex-quiniela-actions">
                {activeEntry && activeEntry.status === "draft" && (
                  <span className="apex-quiniela-draft-hint">Tienes una participación en borrador. Marca los {selected.matchIds.length} partidos para enviarla.</span>
                )}
                <div className="apex-quiniela-actions-buttons">
                  {activeEntry && activeEntry.status !== "draft" && (
                    <button className="apex-btn-secondary" type="button" onClick={() => mutate(() => joinQuiniela(store, selected))} disabled={(user?.points || 0) < selected.entryCost}>
                      <Coins size={16} /> Añadir otra ({selected.entryCost} coins)
                    </button>
                  )}
                  <button className="apex-btn-primary" type="button" disabled={!done} onClick={handleParticipate}>
                    {activeEntry ? "Guardar y enviar" : `Participar · ${selected.entryCost} coins`}
                  </button>
                </div>
              </div>
            )}

            {selected.status === "finished" && (
              <div className="apex-quiniela-actions">
                <button className="apex-btn-primary" type="button" onClick={() => mutate(() => resolveQuiniela(store, selected, sportsData.matches || []))}>
                  Publicar resultados
                </button>
              </div>
            )}
          </section>
        )}

        {selected && (
          <section className="apex-history">
            <div><h2>Ranking y premios</h2><button type="button">{ranking.length} jugadores</button></div>
            {ranking.length ? ranking.map((row, index) => (
              <article key={row.id}>
                <span>{row.position || index + 1}</span>
                <div><strong>{row.userId === "current_user" ? user?.username || "Jordi" : row.userId}</strong><small>{row.correctPredictions || 0} aciertos · enviado {row.submittedAt ? new Date(row.submittedAt).toLocaleString("es-ES") : "sin enviar"}</small></div>
                <aside><b>{row.status}</b><em>{row.prizeWon ? `+${row.prizeWon} coins` : "0 coins"}</em></aside>
              </article>
            )) : <article className="empty"><strong>Aun no hay participantes</strong></article>}
          </section>
        )}
      </div>
    </div>
  );
}
