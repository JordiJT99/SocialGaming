import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser, loadStore, makePrediction, saveStore } from "./data/store";
import { fetchSportsData } from "./services/sportsData";
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
    source: "API-Football",
    loading: true,
    error: null,
  });

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    let active = true;

    fetchSportsData()
      .then((payload) => {
        if (active) setSportsData({ ...payload, loading: false, error: null });
      })
      .catch((error) => {
        if (active) {
          setSportsData({
            matches: [],
            standings: [],
            source: "API-Football",
            loading: false,
            error: error.message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const triggerStoreChange = useCallback(() => setStore(loadStore()), []);

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
            <Route path="/dashboard" element={<Dashboard store={store} matches={sportsData.matches} standings={sportsData.standings} sportsData={sportsData} onPredict={handlePredict} user={user} />} />
            <Route path="/predictions" element={<Predictions store={store} onPredict={handlePredict} matches={sportsData.matches} sportsData={sportsData} />} />
            <Route path="/sportsbook" element={<Sportsbook sportsData={sportsData} />} />
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
