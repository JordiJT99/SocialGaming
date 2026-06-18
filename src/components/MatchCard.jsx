import { useState } from "react";

export default function MatchCard({ match, onPredict, existingPrediction }) {
  const [selected, setSelected] = useState(
    existingPrediction?.selection || null
  );
  const [betAmount] = useState(100);
  const [confirming, setConfirming] = useState(false);

  const handleSelect = (option) => {
    if (match.status === "finished") return;
    if (confirming) return;
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

  return (
    <div className={`match-card ${isFinished ? "finished" : ""} ${isLive ? "live" : ""} ${existingPrediction ? "predicted" : ""}`}>
      <div className="match-header">
        <span className="match-league">{match.league}</span>
        <span className="match-time">
          {isFinished
            ? "Finalizado"
            : isLive
              ? "En vivo"
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
          <span className="team-name">{match.home}</span>
        </div>
        <div className="match-vs">
          {isFinished ? (
            <span className="match-result">{match.result}</span>
          ) : (
            <span>VS</span>
          )}
        </div>
        <div className="team away">
          <span className="team-name">{match.away}</span>
        </div>
      </div>

      {isFinished ? (
        <div className="match-outcome">
          {existingPrediction && (
            <span className={`prediction-badge ${existingPrediction.status}`}>
              {existingPrediction.status === "won"
                ? `+${existingPrediction.pointsWon} pts`
                : existingPrediction.status === "lost"
                  ? `-${existingPrediction.pointsBet} pts`
                  : "Pendiente"}
            </span>
          )}
        </div>
      ) : (
        <div className="match-odds">
          {["1", "X", "2"].map((option) => {
            const isSelected = selected === option;
            return (
              <button
                key={option}
                className={`odds-btn ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelect(option)}
                disabled={isPast || existingPrediction}
              >
                <span className="odds-label">
                  {option === "1" ? match.home : option === "2" ? match.away : "Empate"}
                </span>
                <span className="odds-value">{match.odds[option].toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      )}

      {confirming && selected && (
        <div className="confirm-bar">
          <span>¿{selected === "1" ? match.home : selected === "2" ? match.away : "Empate"}? ({betAmount} pts)</span>
          <div className="confirm-actions">
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>✓</button>
            <button className="btn btn-outline btn-sm" onClick={handleCancel}>✗</button>
          </div>
        </div>
      )}

      {existingPrediction && !confirming && (
        <div className="predicted-mark">
          Tu pick: <strong>{existingPrediction.selection}</strong>
          {existingPrediction.status === "pending" && " — Pendiente"}
        </div>
      )}
    </div>
  );
}
