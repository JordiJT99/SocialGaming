import { CheckCircle2, SlidersHorizontal, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";
import BetConfirm from "./BetConfirm";

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name.slice(0, 3).toUpperCase()}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

export default function MatchCard({ match, onPredict, existingPrediction, balance = 0 }) {
  const [selected, setSelected] = useState(existingPrediction?.selection || null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const hasOdds = Boolean(match.odds);
  const options = match.odds ? ["1", ...(match.odds.X ? ["X"] : []), "2"] : [];
  const pendingLabel = existingPrediction?.status === "pending_quote"
    ? "PENDIENTE DE VALIDACION"
    : existingPrediction?.status === "needs_confirmation"
      ? "CAMBIO PENDIENTE"
      : "TU PREDICCION";

  const confirm = async (pointsBet) => {
    if (!selected || isFinished || isLive || existingPrediction || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onPredict?.(match.id, selected, pointsBet, match.oddsEventId, match.odds[selected], {
        home: match.home,
        away: match.away,
        homeBadge: match.homeBadge,
        awayBadge: match.awayBadge,
      });
    } catch (validationError) {
      setError(validationError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className={`apex-prediction-card ${isLive ? "is-live" : ""} ${isFinished ? "is-finished" : ""}`}>
      <header>
        <span><Trophy size={15} /> {match.league}{match.round ? ` · ${match.round}` : ""}</span>
        {isLive ? <b><i /> LIVE {match.elapsed ? `${match.elapsed}'` : ""}</b> : isFinished ? <b className="finished">FINAL</b> : <time>{new Date(match.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {new Date(match.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>}
      </header>
      <div className="apex-prediction-body">
        <div className="apex-prediction-teams">
          <div><Crest src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
          <span>{isLive || isFinished ? match.score || "0 - 0" : "VS"}</span>
          <div><Crest src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
        </div>

        {existingPrediction || (isLive && selected) ? (
          <div className="apex-current-pick">
            <div><small>{pendingLabel}</small><strong>{selected === "1" ? match.home : selected === "2" ? match.away : "Empate"} ({selected})</strong></div>
            <CheckCircle2 size={21} />
            <button type="button" aria-label="Estadisticas"><TrendingUp size={22} /></button>
          </div>
        ) : isFinished ? (
          <div className="apex-final-result"><CheckCircle2 size={19} /> Resultado oficial: {match.score}</div>
        ) : !isLive && options.length ? (
          <div className="apex-prediction-odds">
            {options.map((option) => (
              <button disabled={submitting} key={option} type="button" className={selected === option ? "selected" : ""} onClick={() => setSelected(option)}>
                <small>{option}</small><strong>{match.odds[option].toFixed(2)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="apex-final-result muted">{isLive ? "Mercado suspendido durante el directo" : error || "Sin cuotas publicadas"}</div>
        )}
        {!isFinished && !isLive && hasOdds && !match.bettingOpen && !existingPrediction && (
          <div className="apex-final-result muted">La cuota se validara despues de enviar la apuesta</div>
        )}
        {selected && !existingPrediction && !isLive && !isFinished && (
          <BetConfirm
            label={selected === "1" ? match.home : selected === "2" ? match.away : "Empate"}
            odds={match.odds[selected]}
            balance={balance}
            submitting={submitting}
            onCancel={() => setSelected(null)}
            onConfirm={confirm}
          />
        )}
        {error && <div className="apex-final-result muted">{error}</div>}
      </div>
      {!isLive && !isFinished && (
        <footer><button type="button">MODO AVANZADO <SlidersHorizontal size={15} /></button><span>⚡ Puntos: +240</span></footer>
      )}
    </article>
  );
}
