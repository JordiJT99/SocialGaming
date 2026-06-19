import { useState } from "react";
import { CircleDot, Dribbble, Goal, Star, Trophy } from "lucide-react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import MatchCard from "../components/MatchCard";
import { SPORTS } from "../data/matches";

const SPORT_ICONS = {
  1: Goal,
  2: Dribbble,
  3: CircleDot,
  5: Trophy,
  6: Star,
};

export default function Predictions({ store, onPredict, matches, sportsData }) {
  const [sportFilter, setSportFilter] = useState(null);
  const filtered = sportFilter ? matches.filter((match) => match.sportId === sportFilter) : matches;

  return (
    <div className="page predictions-page">
      <div className="page-header">
        <div>
          <h1>Predicciones</h1>
          <p className="text-muted">Elige tu resultado y confirma el pick antes del inicio.</p>
        </div>
        <span className={`data-source ${!sportsData?.error ? "is-live" : ""}`}>
          {sportsData?.loading ? "Conectando" : sportsData?.error ? "Sin conexión" : sportsData?.source}
        </span>
      </div>

      <div className="sport-filters">
        <button className={`sport-filter-btn ${sportFilter === null ? "active" : ""}`} onClick={() => setSportFilter(null)}>
          Todos
        </button>
        {SPORTS.map((sport) => {
          const Icon = SPORT_ICONS[sport.id] || CircleDot;
          return (
            <button
              key={sport.id}
              className={`sport-filter-btn ${sportFilter === sport.id ? "active" : ""}`}
              onClick={() => setSportFilter(sport.id)}
            >
              <Icon size={15} /> {sport.name}
            </button>
          );
        })}
      </div>

      {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando partidos</strong></div>}
      {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>No se pudieron cargar los partidos</strong><p>{sportsData.error}</p></div>}

      <div className="matches-grid">
        {filtered.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            existingPrediction={store.predictions.find((prediction) => prediction.matchId === match.id && prediction.userId === "current_user")}
            onPredict={onPredict}
          />
        ))}
      </div>

      {filtered.length === 0 && <p className="empty-state">No hay partidos disponibles para este deporte.</p>}
    </div>
  );
}
