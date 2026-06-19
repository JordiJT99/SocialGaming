import { useState } from "react";

export default function MatchCard({ match, onPredict, existingPrediction }) {
  const [selected, setSelected] = useState(existingPrediction?.selection || null);
  const [betAmount] = useState(100);
  const [confirming, setConfirming] = useState(false);

  const handleSelect = (option) => {
    if (match.status === "finished" || confirming) return;
    setSelected(option);
    setConfirming(true);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onPredict(match.id, selected, betAmount);
    setConfirming(false);
  };

  const handleCancel = () => {
    setSelected(null);
    setConfirming(false);
  };

  const date = new Date(match.date);
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isPast = date < new Date();
  const selectionName = selected === "1" ? match.home : selected === "2" ? match.away : "Empate";

  return (
    <div className={`match-card ${isFinished ? "finished" : ""} ${isLive ? "live" : ""} ${existingPrediction ? "predicted" : ""}`}>
      <div className="match-header">
        <span className="match-league">{match.league}</span>
        <span className="match-time">
          {isFinished
            ? "Finalizado"
            : isLive
              ? "En directo"
              : date.toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
        </span>
      </div>

      <div className="match-teams">
        <div className="team home">
          {match.homeBadge && <img className="match-team-badge" src={match.homeBadge} alt="" />}
          <span className="team-name">{match.home}</span>
        </div>
        <div className="match-vs">
          {isFinished ? <span className="match-result">{match.result}</span> : <span>VS</span>}
        </div>
        <div className="team away">
          <span className="team-name">{match.away}</span>
          {match.awayBadge && <img className="match-team-badge" src={match.awayBadge} alt="" />}
        </div>
      </div>

      {isFinished ? (
        <div className="match-outcome">
          {existingPrediction && (
            <span className={`prediction-badge ${existingPrediction.status}`}>
              {existingPrediction.status === "won"
                ? `+${existingPrediction.pointsWon} coins`
                : existingPrediction.status === "lost"
                  ? `-${existingPrediction.pointsBet} coins`
                  : "Pendiente"}
            </span>
          )}
        </div>
      ) : match.odds ? (
        <div className="match-odds">
          {["1", "X", "2"].map((option) => (
            <button
              key={option}
              className={`odds-btn ${selected === option ? "selected" : ""}`}
              onClick={() => handleSelect(option)}
              disabled={isPast || existingPrediction}
            >
              <span className="odds-label">
                {option === "1" ? match.home : option === "2" ? match.away : "Empate"}
              </span>
              <span className="odds-value">{match.odds[option].toFixed(2)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="odds-unavailable">API-Football todavía no ha publicado cuotas para este partido.</div>
      )}

      {confirming && selected && (
        <div className="confirm-bar">
          <span><strong>{selectionName}</strong> · {betAmount} coins</span>
          <div className="confirm-actions">
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>Confirmar</button>
            <button className="btn btn-outline btn-sm" onClick={handleCancel}>Cancelar</button>
          </div>
        </div>
      )}

      {existingPrediction && !confirming && (
        <div className="predicted-mark">
          Tu pick: <strong>{existingPrediction.selection}</strong>
          {existingPrediction.status === "pending" && " · Pendiente"}
        </div>
      )}
    </div>
  );
}
