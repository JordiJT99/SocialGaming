import { CheckCircle2, SlidersHorizontal, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name.slice(0, 3).toUpperCase()}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

export default function MatchCard({ match, onPredict, existingPrediction }) {
  const [selected, setSelected] = useState(existingPrediction?.selection || null);
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const options = match.odds ? ["1", ...(match.odds.X ? ["X"] : []), "2"] : [];

  const select = (option) => {
    if (isFinished || existingPrediction) return;
    setSelected(option);
    onPredict?.(match.id, option, 100);
  };

  return (
    <article className={`apex-prediction-card ${isLive ? "is-live" : ""} ${isFinished ? "is-finished" : ""}`}>
      <header>
        <span><Trophy size={15} /> {match.league}{match.round ? ` · ${match.round}` : ""}</span>
        {isLive ? <b><i /> LIVE {match.elapsed ? `${match.elapsed}'` : ""}</b> : isFinished ? <b className="finished">FINAL</b> : <time>{new Date(match.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>}
      </header>
      <div className="apex-prediction-body">
        <div className="apex-prediction-teams">
          <div><Crest src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
          <span>{isLive || isFinished ? match.score || "0 - 0" : "VS"}</span>
          <div><Crest src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
        </div>

        {existingPrediction || (isLive && selected) ? (
          <div className="apex-current-pick">
            <div><small>TU PREDICCIÓN</small><strong>{selected === "1" ? match.home : selected === "2" ? match.away : "Empate"} ({selected})</strong></div>
            <CheckCircle2 size={21} />
            <button type="button" aria-label="Estadisticas"><TrendingUp size={22} /></button>
          </div>
        ) : isFinished ? (
          <div className="apex-final-result"><CheckCircle2 size={19} /> Resultado oficial: {match.score}</div>
        ) : options.length ? (
          <div className="apex-prediction-odds">
            {options.map((option) => (
              <button key={option} type="button" className={selected === option ? "selected" : ""} onClick={() => select(option)}>
                <small>{option}</small><strong>{match.odds[option].toFixed(2)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="apex-final-result muted">Cuotas pendientes de publicación</div>
        )}
      </div>
      {!isLive && !isFinished && (
        <footer><button type="button">MODO AVANZADO <SlidersHorizontal size={15} /></button><span>⚡ Puntos: +240</span></footer>
      )}
    </article>
  );
}
