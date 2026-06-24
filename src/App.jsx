import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser, loadStore, makePrediction, refundPrediction, resolvePrediction, saveStore } from "./data/store";
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
import Eventos from "./pages/Eventos";
import EventDetail from "./pages/EventDetail";
import OnboardingTour from "./components/OnboardingTour";

export default function App() {
  const [store, setStore] = useState(() => loadStore());
  const [sportsData, setSportsData] = useState({
    matches: [],
    standings: [],
    source: "ESPN",
    loading: true,
    error: null,
  });
  const [oddsStatus, setOddsStatus] = useState(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    const finished = new Map(
      sportsData.matches
        .filter((match) => match.status === "finished" && match.result)
        .map((match) => [match.id, match]),
    );
    if (!finished.size || !store.predictions.some((item) => item.status === "pending" && finished.has(item.matchId))) return;

    setStore((previous) => {
      const updated = {
        ...previous,
        users: previous.users.map((item) => ({ ...item })),
        predictions: previous.predictions.map((item) => ({ ...item })),
        transactions: [...previous.transactions],
      };
      updated.predictions
        .filter((item) => item.status === "pending" && finished.has(item.matchId))
        .forEach((item) => {
          const match = finished.get(item.matchId);
          resolvePrediction(updated, item.id, match.result, match.score);
        });
      return updated;
    });
  }, [sportsData.matches, store.predictions]);

  const validatePrediction = useCallback(async ({ eventId, selection, offeredOdds, acceptChange = false, placedAt }) => {
    const response = await fetch("/api/predictions/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, selection, offeredOdds, acceptChange, placedAt }),
    });
    const payload = await response.json();
    return { response, payload };
  }, []);

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
    const loadOddsStatus = () => fetch("/api/odds/status")
      .then((response) => response.json())
      .then(setOddsStatus)
      .catch(() => {});
    loadOddsStatus();

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadSports(true);
        loadOddsStatus();
      }
    }, 30 * 1000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const pendingItems = store.predictions.filter((item) =>
      item.userId === "current_user"
      && ["pending_quote", "needs_confirmation"].includes(item.status)
      && item.oddsEventId,
    );
    if (!pendingItems.length) return;

    let cancelled = false;
    const checkPending = () => Promise.all(pendingItems.map((prediction) =>
      validatePrediction({
        eventId: prediction.oddsEventId,
        selection: prediction.selection,
        offeredOdds: prediction.offeredOdds,
        placedAt: prediction.createdAt,
      }).then((result) => ({ predictionId: prediction.id, ...result })),
    )).then((results) => {
      if (cancelled) return;
      setStore((previous) => {
        let changed = false;
        const updated = {
          ...previous,
          predictions: previous.predictions.map((prediction) => {
            const result = results.find((item) => item.predictionId === prediction.id);
            if (!result) return prediction;
            if (result.response.ok) {
              changed = true;
              return {
                ...prediction,
                status: "pending",
                confirmedOdds: result.payload.odds,
                confirmedAt: result.payload.validatedAt,
                currentOdds: null,
                lastValidationError: null,
              };
            }
            if (result.payload.code === "ODDS_CHANGED") {
              changed = true;
              return {
                ...prediction,
                status: "needs_confirmation",
                currentOdds: result.payload.currentOdds,
                lastValidationError: result.payload.error,
              };
            }
            if (result.payload.code === "ODDS_STALE" && prediction.status !== "pending_quote") {
              changed = true;
              return {
                ...prediction,
                status: "pending_quote",
                lastValidationError: result.payload.error,
              };
            }
            return prediction;
          }),
        };
        if (changed) saveStore(updated);
        return changed ? updated : previous;
      });
    }).catch(() => {});
    checkPending();
    const timer = window.setInterval(checkPending, 30 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [store.predictions, validatePrediction]);

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
          oddsEventId: oddsMatch.oddsEventId,
          oddsUpdatedAt: oddsMatch.oddsUpdatedAt,
          bettingOpen: oddsMatch.bettingOpen,
          homeBadge: match.homeBadge || oddsMatch.homeBadge,
          awayBadge: match.awayBadge || oddsMatch.awayBadge,
        };
      });
      return { ...previous, matches: [...matches, ...incoming.values()], error: null };
    });
  }, []);

  const handlePredict = useCallback(async (matchId, selection, pointsBet, oddsEventId, offeredOdds, matchDetails = {}) => {
    const balance = getCurrentUser(store)?.points || 0;
    if (!Number.isInteger(pointsBet) || pointsBet <= 0) throw new Error("Introduce una cantidad valida");
    if (pointsBet > balance) throw new Error("No tienes suficientes monedas");
    const { response, payload: validation } = await validatePrediction({ eventId: oddsEventId, selection, offeredOdds });
    if (!response.ok && !["ODDS_STALE", "ODDS_CHANGED"].includes(validation.code)) {
      throw new Error(validation.error || "No se pudo validar la cuota");
    }

    setStore((previous) => {
      const updated = {
        ...previous,
        users: previous.users.map((item) => ({ ...item })),
        predictions: [...previous.predictions],
        transactions: [...previous.transactions],
      };
      makePrediction(updated, matchId, selection, pointsBet, {
        ...matchDetails,
        oddsEventId,
        offeredOdds,
        confirmedOdds: response.ok ? validation.odds : null,
        currentOdds: validation.currentOdds || null,
        status: response.ok ? "pending" : validation.code === "ODDS_CHANGED" ? "needs_confirmation" : "pending_quote",
        lastValidationError: response.ok ? null : validation.error,
      });
      saveStore(updated);
      return updated;
    });
    return validation;
  }, [store, validatePrediction]);

  const handleAcceptPendingChange = useCallback(async (predictionId) => {
    const prediction = store.predictions.find((item) => item.id === predictionId);
    if (!prediction) return;
    const { response, payload } = await validatePrediction({
      eventId: prediction.oddsEventId,
      selection: prediction.selection,
      offeredOdds: prediction.offeredOdds,
      acceptChange: true,
    });
    if (!response.ok) throw new Error(payload.error || "No se pudo confirmar la cuota");
    setStore((previous) => {
      const updated = {
        ...previous,
        predictions: previous.predictions.map((item) =>
          item.id === predictionId
            ? { ...item, status: "pending", confirmedOdds: payload.odds, confirmedAt: payload.validatedAt, currentOdds: null, lastValidationError: null }
            : item),
      };
      saveStore(updated);
      return updated;
    });
  }, [store.predictions, validatePrediction]);

  const handleCancelPendingChange = useCallback((predictionId) => {
    setStore((previous) => {
      const updated = { ...previous, predictions: [...previous.predictions], users: [...previous.users], transactions: [...previous.transactions] };
      refundPrediction(updated, predictionId, "Prediccion cancelada por cambio de cuota");
      return loadStore();
    });
  }, []);

  const user = getCurrentUser(store);
  const socialUsers = [user].filter(Boolean);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppHeader user={user} store={store} />
        <OnboardingTour />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home sportsData={sportsData} store={store} onPredict={handlePredict} user={user} />} />
            <Route path="/dashboard" element={<Home sportsData={sportsData} store={store} onPredict={handlePredict} user={user} />} />
            <Route path="/predictions" element={<Predictions store={store} onPredict={handlePredict} onSportSelect={loadSport} matches={sportsData.matches} sportsData={sportsData} oddsStatus={oddsStatus} />} />
            <Route path="/live" element={<Predictions liveOnly store={store} onPredict={handlePredict} onSportSelect={loadSport} matches={sportsData.matches} sportsData={sportsData} oddsStatus={oddsStatus} />} />
            <Route path="/sportsbook" element={<Sportsbook sportsData={sportsData} onSportSelect={loadSport} />} />
            <Route path="/ranking" element={<Ranking standings={sportsData.standings} sportsData={sportsData} />} />
            <Route path="/leagues" element={<Leagues store={store} onStoreChange={triggerStoreChange} allUsers={socialUsers} />} />
            <Route path="/leagues/:leagueId" element={<LeagueDetail store={store} allUsers={socialUsers} />} />
            <Route path="/profile" element={<Profile store={store} user={user} matches={sportsData.matches} onAcceptPendingChange={handleAcceptPendingChange} onCancelPendingChange={handleCancelPendingChange} />} />
            <Route path="/fantasy" element={<Fantasy />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/rewards" element={<Rewards user={user} />} />
            <Route path="/events" element={<Eventos sportsData={sportsData} onSportSelect={loadSport} store={store} onPredict={handlePredict} user={user} />} />
            <Route path="/events/:eventId" element={<EventDetail sportsData={sportsData} store={store} onPredict={handlePredict} user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
