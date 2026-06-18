import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { loadStore, saveStore, getCurrentUser, makePrediction, resolvePrediction } from "./data/store";
import { MATCHES, USERS as MOCK_USERS } from "./data/matches";
import AppHeader from "./components/AppHeader";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Predictions from "./pages/Predictions";
import Leagues from "./pages/Leagues";
import LeagueDetail from "./pages/LeagueDetail";
import Ranking from "./pages/Ranking";
import Profile from "./pages/Profile";

export default function App() {
  const [store, setStore] = useState(() => loadStore());

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const triggerStoreChange = useCallback(() => {
    setStore(loadStore());
  }, []);

  const handlePredict = useCallback((matchId, selection, pointsBet) => {
    setStore((prev) => {
      const updated = { ...prev, predictions: [...prev.predictions] };
      makePrediction(updated, matchId, selection, pointsBet);
      const user = getCurrentUser(updated);
      const updatedUsers = updated.users.map((u) =>
        u.id === "current_user" ? user : u
      );
      updated.users = updatedUsers;
      saveStore(updated);
      return updated;
    });
  }, []);

  const user = getCurrentUser(store);
  const allUsers = [...MOCK_USERS, user].filter(Boolean);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppHeader user={user} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  store={store}
                  matches={MATCHES}
                  allUsers={allUsers}
                  onPredict={handlePredict}
                  user={user}
                />
              }
            />
            <Route
              path="/predictions"
              element={
                <Predictions store={store} onPredict={handlePredict} />
              }
            />
            <Route
              path="/leagues"
              element={
                <Leagues
                  store={store}
                  onStoreChange={triggerStoreChange}
                  allUsers={allUsers}
                />
              }
            />
            <Route
              path="/leagues/:leagueId"
              element={
                <LeagueDetail store={store} allUsers={allUsers} />
              }
            />
            <Route
              path="/ranking"
              element={
                <Ranking allUsers={allUsers} currentUser={user} />
              }
            />
            <Route
              path="/profile"
              element={
                <Profile store={store} user={user} />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
