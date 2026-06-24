import { CheckCircle2, SlidersHorizontal, TrendingUp, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name.slice(0, 3).toUpperCase()}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

const SELECTION_LABELS = { "1": "Local", "X": "Empate", "2": "Visitante" };

export default function MatchCard({ match, onAddToSlip, existingPrediction, slipItems = [] }) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const hasOdds = Boolean(match.odds);
  const options = match.odds ? ["1", ...(match.odds.X ? ["X"] : []), "2"] : [];
  const inSlip = slipItems.find((item) => item.eventId === match.id);
  const pendingLabel = existingPrediction?.status === "pending_quote"
    ? "PENDIENTE DE VALIDACION"
    : existingPrediction?.status === "needs_confirmation"
      ? "CAMBIO PENDIENTE"
      : "TU PREDICCION";

  const pickLabel = inSlip ? SELECTION_LABELS[inSlip.selection] || inSlip.selection : null;

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

        {existingPrediction ? (
          <div className="apex-current-pick">
            <div><small>{pendingLabel}</small><strong>{existingPrediction.selection === "1" ? match.home : existingPrediction.selection === "2" ? match.away : "Empate"} ({existingPrediction.selection})</strong></div>
            <CheckCircle2 size={21} />
            <button type="button" aria-label="Estadisticas"><TrendingUp size={22} /></button>
          </div>
        ) : inSlip ? (
          <div className="apex-current-pick in-slip">
            <div><small>EN TU CUPÓN</small><strong>{pickLabel} ({inSlip.selection})</strong></div>
            <span className="apex-slip-odd">{inSlip.odd?.toFixed(2)}</span>
            <Link to="/events" className="apex-slip-view">Ver cupón</Link>
          </div>
        ) : isFinished ? (
          <div className="apex-final-result"><CheckCircle2 size={19} /> Resultado oficial: {match.score}</div>
        ) : !isLive && options.length ? (
          <div className="apex-prediction-odds">
            {options.map((option) => (
              <button key={option} type="button" onClick={() => onAddToSlip?.(match, option, match.odds[option])}>
                <small>{option}</small><strong>{match.odds[option].toFixed(2)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="apex-final-result muted">{isLive ? "Mercado suspendido durante el directo" : "Sin cuotas publicadas"}</div>
        )}
        {!isFinished && !isLive && hasOdds && !match.bettingOpen && !existingPrediction && !inSlip && (
          <div className="apex-final-result muted">La cuota se validara despues de enviar la apuesta</div>
        )}
      </div>
      {!isLive && !isFinished && (
        <footer><button type="button">MODO AVANZADO <SlidersHorizontal size={15} /></button><span>⚡ Puntos: +240</span></footer>
      )}
    </article>
  );
}
