import { useState } from "react";
import MatchCard from "../components/MatchCard";
import { MATCHES, SPORTS } from "../data/matches";

export default function Predictions({ store, onPredict }) {
  const [sportFilter, setSportFilter] = useState(null);

  const filtered = sportFilter
    ? MATCHES.filter((m) => m.sportId === sportFilter)
    : MATCHES;

  return (
    <div className="page predictions-page">
      <div className="page-header">
        <h1>Predicciones</h1>
        <p className="text-muted">Elige tu pronóstico para cada partido y gana puntos</p>
      </div>

      <div className="sport-filters">
        <button
          className={`sport-filter-btn ${sportFilter === null ? "active" : ""}`}
          onClick={() => setSportFilter(null)}
        >
          Todos
        </button>
        {SPORTS.map((s) => (
          <button
            key={s.id}
            className={`sport-filter-btn ${sportFilter === s.id ? "active" : ""}`}
            onClick={() => setSportFilter(s.id)}
          >
            <span>{s.icon}</span> {s.name}
          </button>
        ))}
      </div>

      <div className="matches-grid">
        {filtered.map((m) => {
          const existing = store.predictions.find(
            (p) => p.matchId === m.id && p.userId === "current_user"
          );
          return (
            <MatchCard
              key={m.id}
              match={m}
              existingPrediction={existing}
              onPredict={onPredict}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="empty-state">No hay partidos disponibles para este deporte.</p>
      )}
    </div>
  );
}
