import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  deriveResult,
  expireOldPrediction,
  getCurrentUser,
  loadStore,
  makePrediction,
  refundPrediction,
  resolvePrediction,
  saveStore,
  setActiveAuthUser,
} from "./data/store";
import { fetchSportsData } from "./services/sportsData";
import { fetchTheOddsData } from "./services/theOddsApi";
import AppHeader from "./components/AppHeader";
import BetSlip from "./components/BetSlip";
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
import Auth from "./pages/Auth";

function OddsBudgetPill({ status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!status) return null;
  const used = status.usedLastHour || 0;
  const budget = status.internalBudget || 95;
  const remaining = Math.max(0, budget - used);
  const resetMs = Math.max(0, (status.rateLimitResetAt || status.nextRefreshAt || 0) - now);
  const min = Math.floor(resetMs / 60000);
  const sec = Math.floor((resetMs % 60000) / 1000);
  const reset = resetMs > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : "ahora";
  const tone = remaining > 30 ? "ok" : remaining > 10 ? "warn" : "danger";

  return (
    <div className={`apex-odds-pill apex-odds-pill-${tone}`} title="Reset real del cupo de Odds API (ventana de 1h del proveedor)">
      <span className="apex-odds-pill-dot" />
      <span><b>{used}</b>/{budget} req</span>
      <span className="apex-odds-pill-sep">·</span>
      <span>↻ {reset}</span>
    </div>
  );
}

const stripSeedData = (state) => {
  const next = structuredClone(state);
  next.leagues = (next.leagues || []).filter((league) => league.id !== "league_1" && league.code !== "CHAMP24");
  next.leagueActivity = (next.leagueActivity || []).filter((entry) => entry.leagueId !== "league_1");
  return next;
};

export default function App() {
  const [store, setStore] = useState(() => loadStore());
  const [sessionUser, setSessionUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [economy, setEconomy] = useState(null);
  const economySeededRef = useRef(false);
  const storeReadyRef = useRef(false);
  const [sportsData, setSportsData] = useState({
    matches: [],
    standings: [],
    source: "ESPN",
    loading: true,
    error: null,
  });
  const [oddsStatus, setOddsStatus] = useState(null);
  const [slipItems, setSlipItems] = useState([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipSubmitting, setSlipSubmitting] = useState(false);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    const hydrateStore = async (nextUser) => {
      setActiveAuthUser(nextUser);
      let nextStore = loadStore();
      if (nextUser) {
        const response = await fetch("/api/app-state").catch(() => null);
        if (response?.ok) {
          const payload = await response.json();
          nextStore = payload.state ? payload.state : stripSeedData(nextStore);
        }
        const localUser = getCurrentUser(nextStore);
        if (localUser) {
          localUser.username = nextUser.username;
          localUser.email = nextUser.email;
          localUser.joinedAt = nextUser.joinedAt || localUser.joinedAt;
        }
      }
      setStore(nextStore);
      saveStore(nextStore);
      storeReadyRef.current = true;
    };

    (async () => {
      try {
        const response = await fetch("/api/auth/me");
        const payload = await response.json();
        const nextUser = payload.user || null;
        setSessionUser(nextUser);
        await hydrateStore(nextUser);
      } catch {
        setSessionUser(null);
        setActiveAuthUser(null);
        storeReadyRef.current = true;
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authReady || !sessionUser || !storeReadyRef.current) return;
    const timer = window.setTimeout(() => {
      fetch("/api/app-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: store }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [authReady, sessionUser, store]);

  const economyHeaders = useCallback(() => ({
    "content-type": "application/json",
  }), []);

  const applyCoinDelta = useCallback((delta) => {
    if (!delta) return;
    setStore((previous) => {
      const updated = structuredClone(previous);
      const currentUser = getCurrentUser(updated);
      if (currentUser) {
        currentUser.points = Math.max(0, (currentUser.points || 0) + delta);
        if (delta > 0) currentUser.totalEarned = (currentUser.totalEarned || 0) + delta;
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!authReady || !sessionUser) return;
    if (economySeededRef.current) return;
    economySeededRef.current = true;
    const legacy = {
      user: {
        rewardStreak: getCurrentUser(store)?.rewardStreak || 0,
        lastRewardClaimAt: getCurrentUser(store)?.lastRewardClaimAt || null,
      },
      rewardActivity: store.rewardActivity || { videoClaims: [], completedOffers: [] },
      prizesRedeemed: store.prizesRedeemed || [],
    };
    fetch("/api/economy/sync", {
      method: "POST",
      headers: economyHeaders(),
      body: JSON.stringify({ legacy }),
    })
      .then((response) => response.json())
      .then(setEconomy)
      .catch(() => {});
  }, [authReady, economyHeaders, sessionUser, store]);

  useEffect(() => {
    const finished = new Map(
      sportsData.matches
        .filter((match) => match.status === "finished")
        .map((match) => [match.id, match]),
    );
    if (!finished.size || !store.predictions.some((item) => item.status === "pending" && finished.has(item.matchId))) return;

    setStore((previous) => {
      const updated = {
        ...previous,
        users: previous.users,
        predictions: previous.predictions,
        transactions: [...previous.transactions],
      };
      let changed = false;
      updated.predictions
        .filter((item) => item.status === "pending" && finished.has(item.matchId))
        .forEach((item) => {
          const match = finished.get(item.matchId);
          const result = deriveResult(match);
          if (!result) return;
          const res = resolvePrediction(updated, item.id, result, match.score);
          if (res) changed = true;
        });
      return changed ? updated : previous;
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

    let updateCount = 0;
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        // Fuerza fetch sin cache cada 30 min (coincide con sync de server)
        const forceRefresh = (updateCount % 60) === 0;
        loadSports(forceRefresh);
        loadOddsStatus();
        updateCount++;
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
      return { ...previous, matches, error: null };
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

  const addToSlip = useCallback((event, selection, odd) => {
    setSlipItems((prev) => {
      if (prev.some((item) => item.eventId === event.id)) return prev;
      return [...prev, {
        eventId: event.id,
        home: event.home,
        away: event.away,
        homeBadge: event.homeBadge,
        awayBadge: event.awayBadge,
        league: event.league || event.tournament,
        sport: event.sportKey,
        selection,
        odd,
        oddsEventId: event.oddsEventId,
        date: event.date,
      }];
    });
    setSlipOpen(true);
  }, []);

  const removeSlipItem = useCallback((index) => {
    setSlipItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearSlip = useCallback(() => {
    setSlipItems([]);
  }, []);

  const handleConfirmSlip = useCallback(async (amount, mode) => {
    if (slipItems.length === 0 || slipSubmitting) return;
    setSlipSubmitting(true);
    try {
      if (mode === "multiple" && slipItems.length > 1) {
        const combinedOdds = slipItems.reduce((acc, item) => acc * item.odd, 1);
        const first = slipItems[0];
        await handlePredict(first.eventId, first.selection, amount, first.oddsEventId, combinedOdds, {
          home: first.home, away: first.away, homeBadge: first.homeBadge, awayBadge: first.awayBadge,
          date: first.date,
        });
      } else {
        for (const item of slipItems) {
          await handlePredict(item.eventId, item.selection, amount, item.oddsEventId, item.odd, {
            home: item.home, away: item.away, homeBadge: item.homeBadge, awayBadge: item.awayBadge,
            date: item.date,
          });
        }
      }
      setSlipItems([]);
      setSlipOpen(false);
    } catch (err) {
      window.alert(err.message || "No se pudo confirmar la apuesta");
    } finally {
      setSlipSubmitting(false);
    }
  }, [slipItems, slipSubmitting, handlePredict]);

  const user = getCurrentUser(store);
  const socialUsers = [user].filter(Boolean);

  const callEconomy = useCallback(async (path, body = {}, deltaResolver = null) => {
    const response = await fetch(path, {
      method: "POST",
      headers: economyHeaders(),
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No se pudo actualizar la economia");
    if (payload.state) setEconomy(payload.state);
    if (deltaResolver) applyCoinDelta(deltaResolver(payload));
    return payload;
  }, [applyCoinDelta, economyHeaders]);

  const handleClaimDailyReward = useCallback(() =>
    callEconomy("/api/economy/daily", {}, (payload) => Number(payload.reward || 0))
  , [callEconomy]);

  const handleClaimVideoReward = useCallback(() =>
    callEconomy("/api/economy/video", {}, (payload) => Number(payload.reward || 0))
  , [callEconomy]);

  const handleCompleteOffer = useCallback((offer) =>
    callEconomy("/api/economy/offer", { offer }, (payload) => Number(payload.reward || 0))
  , [callEconomy]);

  const handleRedeemPrize = useCallback((prize) =>
    callEconomy("/api/economy/redeem", { reward: prize }, (payload) => -Number(payload.cost || 0))
  , [callEconomy]);

  const handleAuth = useCallback(async (nextUser) => {
    setSessionUser(nextUser);
    setActiveAuthUser(nextUser);
    economySeededRef.current = false;
    storeReadyRef.current = false;
    let nextStore = loadStore();
    const response = await fetch("/api/app-state").catch(() => null);
    if (response?.ok) {
      const payload = await response.json();
      nextStore = payload.state ? payload.state : stripSeedData(nextStore);
    }
    const localUser = getCurrentUser(nextStore);
    if (localUser) {
      localUser.username = nextUser.username;
      localUser.email = nextUser.email;
      localUser.joinedAt = nextUser.joinedAt || localUser.joinedAt;
    }
    setStore(nextStore);
    saveStore(nextStore);
    storeReadyRef.current = true;
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSessionUser(null);
    setEconomy(null);
    setActiveAuthUser(null);
    economySeededRef.current = false;
    storeReadyRef.current = false;
    setStore(loadStore());
    storeReadyRef.current = true;
  }, []);

  if (!authReady) return null;
  if (!sessionUser) return <Auth onAuth={handleAuth} />;

  return (
    <BrowserRouter>
      <div className={`app-shell ${slipOpen ? "slip-open" : ""}`}>
        <AppHeader user={user} store={store} sportsData={sportsData} onLogout={handleLogout} />
        <OnboardingTour />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home sportsData={sportsData} store={store} onPredict={handlePredict} onAddToSlip={addToSlip} slipItems={slipItems} user={user} />} />
            <Route path="/dashboard" element={<Home sportsData={sportsData} store={store} onPredict={handlePredict} onAddToSlip={addToSlip} slipItems={slipItems} user={user} />} />
            <Route path="/predictions" element={<Predictions store={store} onPredict={handlePredict} onSportSelect={loadSport} matches={sportsData.matches} sportsData={sportsData} oddsStatus={oddsStatus} onAddToSlip={addToSlip} slipItems={slipItems} />} />
            <Route path="/live" element={<Predictions liveOnly store={store} onPredict={handlePredict} onSportSelect={loadSport} matches={sportsData.matches} sportsData={sportsData} oddsStatus={oddsStatus} onAddToSlip={addToSlip} slipItems={slipItems} />} />
            <Route path="/sportsbook" element={<Sportsbook sportsData={sportsData} store={store} onStoreChange={triggerStoreChange} onSportSelect={loadSport} user={user} />} />
            <Route path="/ranking" element={<Ranking standings={sportsData.standings} sportsData={sportsData} />} />
            <Route path="/leagues" element={<Leagues store={store} onStoreChange={triggerStoreChange} allUsers={socialUsers} />} />
            <Route path="/leagues/:leagueId" element={<LeagueDetail store={store} allUsers={socialUsers} />} />
            <Route path="/profile" element={<Profile store={store} user={user} matches={sportsData.matches} onAcceptPendingChange={handleAcceptPendingChange} onCancelPendingChange={handleCancelPendingChange} />} />
            <Route path="/fantasy" element={<Fantasy user={sessionUser} />} />
            <Route path="/challenges" element={<Challenges store={store} sportsData={sportsData} user={user} onStoreChange={triggerStoreChange} />} />
            <Route path="/earn" element={<Earn economy={economy} user={user} onClaimDaily={handleClaimDailyReward} onClaimVideo={handleClaimVideoReward} onCompleteOffer={handleCompleteOffer} />} />
            <Route path="/rewards" element={<Rewards economy={economy} user={user} onRedeem={handleRedeemPrize} />} />
            <Route path="/events" element={<Eventos sportsData={sportsData} onSportSelect={loadSport} store={store} onPredict={handlePredict} onAddToSlip={addToSlip} slipItems={slipItems} user={user} />} />
            <Route path="/events/:eventId" element={<EventDetail sportsData={sportsData} store={store} onAddToSlip={addToSlip} slipItems={slipItems} user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BetSlip
          open={slipOpen}
          onClose={() => setSlipOpen(false)}
          items={slipItems}
          onRemoveItem={removeSlipItem}
          onClear={clearSlip}
          onConfirm={handleConfirmSlip}
          user={user}
          submitting={slipSubmitting}
        />
        <OddsBudgetPill status={oddsStatus} />
      </div>
    </BrowserRouter>
  );
}
