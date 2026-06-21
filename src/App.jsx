import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser, loadStore, makePrediction, saveStore } from "./data/store";
import { fetchSportsData } from "./services/sportsData";
import { fetchTheOddsData } from "./services/theOddsApi";
import AppHeader from "./components/AppHeader";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Predictions from "./pages/Predictions";
import Leagues from "./pages/Leagues";
import LeagueDetail from "./pages/LeagueDetail";
import Ranking from "./pages/Ranking";
import Profile from "./pages/Profile";
import Fantasy from "./pages/Fantasy";
import Sportsbook from "./pages/Sportsbook";
import Challenges from "./pages/Challenges";
import Earn from "./pages/Earn";
import Rewards from "./pages/Rewards";

export default function App() {
  const [store, setStore] = useState(() => loadStore());
  const [sportsData, setSportsData] = useState({
    matches: [],
    standings: [],
    source: "ESPN",
    loading: true,
    error: null,
  });

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    let active = true;

    const loadSports = (force = false) => {
      fetchSportsData({ force, includeOdds: true })
        .then((payload) => {
          if (active) setSportsData({ ...payload, loading: false, error: null });
        })
        .catch((error) => {
          if (active) {
            setSportsData((previous) => ({
              ...previous,
              loading: false,
              error: error.message,
            }));
          }
        });
    };

    loadSports();

    const refreshTimer = window.setInterval(() => loadSports(true), 30 * 1000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const triggerStoreChange = useCallback(() => setStore(loadStore()), []);
  const loadSport = useCallback(async (sport) => {
    const payload = await fetchTheOddsData(sport);
    setSportsData((previous) => {
      const normalize = (name) => (name || "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const key = (match) => `${normalize(match.home)}:${normalize(match.away)}`;
      const incoming = new Map(payload.matches.map((match) => [key(match), match]));
      const matches = previous.matches.map((match) => {
        if (match.sportKey !== sport) return match;
        const oddsMatch = incoming.get(key(match));
        if (!oddsMatch) return match;
        incoming.delete(key(match));
        return {
          ...oddsMatch,
          ...match,
          odds: oddsMatch.odds,
          oddsSource: oddsMatch.oddsSource,
          homeBadge: match.homeBadge || oddsMatch.homeBadge,
          awayBadge: match.awayBadge || oddsMatch.awayBadge,
        };
      });
      return { ...previous, matches: [...matches, ...incoming.values()], error: null };
    });
  }, []);

  const handlePredict = useCallback((matchId, selection, pointsBet) => {
    setStore((previous) => {
      const updated = { ...previous, predictions: [...previous.predictions] };
      makePrediction(updated, matchId, selection, pointsBet);
      const user = getCurrentUser(updated);
      updated.users = updated.users.map((item) => item.id === "current_user" ? user : item);
      saveStore(updated);
      return updated;
    });
  }, []);

  const user = getCurrentUser(store);
  const socialUsers = [user].filter(Boolean);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppHeader user={user} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home sportsData={sportsData} />} />
            <Route path="/dashboard" element={<Home sportsData={sportsData} />} />
            <Route path="/predictions" element={<Predictions store={store} onPredict={handlePredict} onSportSelect={loadSport} matches={sportsData.matches} sportsData={sportsData} />} />
            <Route path="/sportsbook" element={<Sportsbook sportsData={sportsData} onSportSelect={loadSport} />} />
            <Route path="/ranking" element={<Ranking standings={sportsData.standings} sportsData={sportsData} />} />
            <Route path="/leagues" element={<Leagues store={store} onStoreChange={triggerStoreChange} allUsers={socialUsers} />} />
            <Route path="/leagues/:leagueId" element={<LeagueDetail store={store} allUsers={socialUsers} />} />
            <Route path="/profile" element={<Profile store={store} user={user} />} />
            <Route path="/fantasy" element={<Fantasy />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/rewards" element={<Rewards user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
