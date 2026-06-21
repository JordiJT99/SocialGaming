import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CircleDot, Dribbble, Goal, History, Trophy } from "lucide-react";
import MatchCard from "../components/MatchCard";

const ICONS = { football: Goal, basketball: Dribbble, baseball: CircleDot, tennis: Trophy };

const SPORT_ORDER = ["football", "basketball", "tennis", "baseball", "hockey"];
const SPORT_NAMES = { football: "Fútbol", basketball: "Baloncesto", tennis: "Tenis", baseball: "Béisbol", hockey: "Hockey" };

export default function Predictions({ store, onPredict, onSportSelect, matches, sportsData }) {
  const [searchParams] = useSearchParams();
  const resultsMode = searchParams.get("status") === "finished";
  const [sportFilter, setSportFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");

  const sports = useMemo(() => {
    const seen = new Set();
    return SPORT_ORDER.filter((key) => {
      const has = matches.some((m) => (m.sportKey || "football") === key);
      if (has && !seen.has(key)) { seen.add(key); return true; }
      return false;
    });
  }, [matches]);

  const leagues = useMemo(() => {
    const set = new Map();
    matches
      .filter((m) => sportFilter === "all" || (m.sportKey || "football") === sportFilter)
      .forEach((m) => { if (!set.has(m.league)) set.set(m.league, m.league); });
    return [...set.values()].sort();
  }, [matches, sportFilter]);

  const filtered = useMemo(() =>
    matches
      .filter((m) =>
        (sportFilter === "all" || (m.sportKey || "football") === sportFilter)
        && (leagueFilter === "all" || m.league === leagueFilter)
        && (resultsMode ? m.status === "finished" : m.status !== "finished"))
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        return new Date(a.date) - new Date(b.date);
      }),
  [matches, sportFilter, leagueFilter, resultsMode]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((m) => {
      const key = m.league;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="apex-page apex-predict-page">
      <div className="apex-sport-tabs">
        <button className={sportFilter === "all" ? "active" : ""} onClick={() => { setSportFilter("all"); setLeagueFilter("all"); }}>Todos</button>
        {sports.map((key) => {
          const Icon = ICONS[key] || CircleDot;
          return (
            <button key={key} className={sportFilter === key ? "active" : ""} onClick={() => { setSportFilter(key); setLeagueFilter("all"); onSportSelect?.(key); }}>
              <Icon size={18} /> {SPORT_NAMES[key] || key}
            </button>
          );
        })}
      </div>

      {leagues.length > 1 && (
        <div className="apex-league-tabs">
          <button className={leagueFilter === "all" ? "active" : ""} onClick={() => setLeagueFilter("all")}>Todas</button>
          {leagues.map((league) => (
            <button key={league} className={leagueFilter === league ? "active" : ""} onClick={() => setLeagueFilter(league)}>{league}</button>
          ))}
        </div>
      )}

      <div className="apex-predict-heading">
        <div><span>{resultsMode ? "RESULTADOS OFICIALES" : "EN DIRECTO Y PRÓXIMOS"}</span><h1>{resultsMode ? "Últimos Resultados" : "Predicciones"}</h1></div>
        <button type="button">Calendario <CalendarDays size={16} /></button>
      </div>

      {sportsData.loading && <div className="apex-empty apex-sync-state">Sincronizando calendario y marcadores...</div>}
      {sportsData.error && <div className="apex-empty apex-sync-state error">No se pudieron sincronizar los partidos.<small>{sportsData.error}</small></div>}
      {!sportsData.loading && !sportsData.error && filtered.length === 0 && <div className="apex-empty apex-sync-state">No hay partidos disponibles.</div>}

      {grouped.map(([league, leagueMatches]) => (
        <div key={league} className="apex-league-group">
          <h3 className="apex-league-heading">{league}<small>{leagueMatches.length} partidos</small></h3>
          <div className="apex-prediction-list">
            {leagueMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                existingPrediction={store.predictions.find((p) => p.matchId === match.id && p.userId === "current_user")}
                onPredict={onPredict}
              />
            ))}
          </div>
        </div>
      ))}

      <section className="apex-combo-card">
        <h2>Combo Boost</h2>
        <p>Combina 3+ predicciones hoy para ganar el doble de monedas y XP.</p>
        <div><i /><i /><i /></div>
      </section>

      <div className="apex-metric-grid">
        <article><Trophy size={24} /><div><span>RANKING LIGA</span><strong>#12</strong></div></article>
        <article><History size={24} /><div><span>TASA DE ÉXITO</span><strong>78%</strong></div></article>
      </div>
    </div>
  );
}
