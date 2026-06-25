import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CircleDot, Dribbble, Goal, History, Trophy } from "lucide-react";
import MatchCard from "../components/MatchCard";
import { matchPriority } from "./predictionPriority";

const ICONS = { football: Goal, basketball: Dribbble, baseball: CircleDot, tennis: Trophy };

const SPORT_ORDER = ["football", "basketball", "tennis", "baseball", "hockey"];
const SPORT_NAMES = { football: "Fútbol", basketball: "Baloncesto", tennis: "Tenis", baseball: "Béisbol", hockey: "Hockey" };

export default function Predictions({ store, onSportSelect, matches, sportsData, oddsStatus, liveOnly = false, onAddToSlip, slipItems = [] }) {
  const [searchParams] = useSearchParams();
  const resultsMode = searchParams.get("status") === "finished";
  const [sportFilter, setSportFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [expandedSports, setExpandedSports] = useState([]);

  const sports = useMemo(() => {
    const seen = new Set();
    const now = Date.now();
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
    return SPORT_ORDER.filter((key) => {
      const has = matches.some((m) => (m.sportKey || "football") === key && (m.status === "live" || (m.status !== "finished" && new Date(m.date).getTime() <= now + FIFTEEN_DAYS)) && m.odds && Object.keys(m.odds).length > 0);
      if (has && !seen.has(key)) { seen.add(key); return true; }
      return false;
    });
  }, [matches]);

  const leagues = useMemo(() => {
    const set = new Map();
    const now = Date.now();
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
    matches
      .filter((m) => (sportFilter === "all" || (m.sportKey || "football") === sportFilter) && (m.status === "live" || (m.status !== "finished" && new Date(m.date).getTime() <= now + FIFTEEN_DAYS)) && m.odds && Object.keys(m.odds).length > 0)
      .forEach((m) => { if (!set.has(m.league)) set.set(m.league, m.league); });
    return [...set.values()].sort();
  }, [matches, sportFilter]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
    return matches
      .filter((m) => {
        const sportOk = sportFilter === "all" || (m.sportKey || "football") === sportFilter;
        const leagueOk = leagueFilter === "all" || m.league === leagueFilter;
        const hasOdds = m.odds && Object.keys(m.odds).length > 0;
        let statusOk;
        if (resultsMode) {
          statusOk = m.status === "finished";
        } else if (liveOnly) {
          statusOk = m.status === "live";
        } else {
          statusOk = (m.status === "live" || (m.status !== "finished" && new Date(m.date).getTime() <= now + FIFTEEN_DAYS)) && hasOdds;
        }
        return sportOk && leagueOk && statusOk;
      })
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        const importance = matchPriority(b) - matchPriority(a);
        if (importance) return importance;
        return new Date(a.date) - new Date(b.date);
      });
  }, [matches, sportFilter, leagueFilter, resultsMode, liveOnly]);

  const grouped = useMemo(() => {
    const counts = new Map();
    const map = new Map();
    filtered.forEach((m) => {
      const sport = m.sportKey || "football";
      const count = counts.get(sport) || 0;
      if (!expandedSports.includes(sport) && count >= 10) return;
      counts.set(sport, count + 1);
      if (!map.has(sport)) map.set(sport, new Map());
      const leaguesBySport = map.get(sport);
      if (!leaguesBySport.has(m.league)) leaguesBySport.set(m.league, []);
      leaguesBySport.get(m.league).push(m);
    });
    return [...map].map(([sport, leaguesBySport]) => [sport, [...leaguesBySport]]);
  }, [filtered, expandedSports]);

  return (
    <div className="apex-page apex-predict-page">
      <div className="apex-sport-tabs">
        <button className={sportFilter === "all" ? "active" : ""} onClick={() => { setSportFilter("all"); setLeagueFilter("all"); setExpandedSports([]); }}>Todos</button>
        {sports.map((key) => {
          const Icon = ICONS[key] || CircleDot;
          return (
            <button key={key} className={sportFilter === key ? "active" : ""} onClick={() => { setSportFilter(key); setLeagueFilter("all"); setExpandedSports([]); onSportSelect?.(key); }}>
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
        <div><span>{resultsMode ? "RESULTADOS OFICIALES" : liveOnly ? "MARCADORES ACTUALIZADOS" : "PRÓXIMOS EN EMPEZAR"}</span><h1>{resultsMode ? "Últimos Resultados" : liveOnly ? "En directo" : "Predicciones"}</h1></div>
        <button type="button" title={oddsStatus ? `${oddsStatus.usedLastHour}/${oddsStatus.internalBudget} consultas locales usadas` : ""}>
          {oddsStatus ? `Cuotas: ${new Date(oddsStatus.nextRefreshAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Calendario"} <CalendarDays size={16} />
        </button>
      </div>

      {sportsData.loading && <div className="apex-empty apex-sync-state">Sincronizando calendario y marcadores...</div>}
      {sportsData.error && <div className="apex-empty apex-sync-state error">No se pudieron sincronizar los partidos.<small>{sportsData.error}</small></div>}
      {!sportsData.loading && !sportsData.error && filtered.length === 0 && <div className="apex-empty apex-sync-state">No hay partidos disponibles.</div>}

      {grouped.map(([sport, leagueGroups]) => {
        const total = filtered.filter((match) => (match.sportKey || "football") === sport).length;
        const canExpand = total > 10 && !expandedSports.includes(sport);
        return (
          <section key={sport} className="apex-sport-section">
            <header className="apex-sport-section-heading">
              <h2>{SPORT_NAMES[sport] || sport}<small>{total} partidos</small></h2>
              {canExpand && <button type="button" onClick={() => setExpandedSports((current) => [...current, sport])}>Ver todos</button>}
            </header>
            {leagueGroups.map(([league, leagueMatches]) => (
              <div key={league} className="apex-league-group">
                <h3 className="apex-league-heading">{league}<small>{leagueMatches.length} partidos</small></h3>
                <div className="apex-prediction-list">
                    {leagueMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      existingPrediction={store.predictions.find((p) => p.matchId === match.id && p.userId === "current_user")}
                      onAddToSlip={onAddToSlip}
                      slipItems={slipItems}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {!liveOnly && <section className="apex-combo-card">
        <h2>Combo Boost</h2>
        <p>Combina 3+ predicciones hoy para ganar el doble de monedas y XP.</p>
        <div><i /><i /><i /></div>
      </section>}

      <div className="apex-metric-grid">
        <article><Trophy size={24} /><div><span>RANKING LIGA</span><strong>#12</strong></div></article>
        <article><History size={24} /><div><span>TASA DE ÉXITO</span><strong>78%</strong></div></article>
      </div>
    </div>
  );
}
