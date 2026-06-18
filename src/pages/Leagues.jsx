import { useState } from "react";
import { Link } from "react-router-dom";
import LeagueCard from "../components/LeagueCard";
import { createLeague, joinLeague, getLeagueRanking } from "../data/store";

export default function Leagues({ store, onStoreChange, allUsers }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    const league = createLeague(store, newName.trim());
    onStoreChange();
    setNewName("");
    setShowCreate(false);
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    const result = joinLeague(store, joinCode.trim().toUpperCase());
    if (result) {
      onStoreChange();
      setJoinCode("");
      setShowJoin(false);
      setError("");
    } else {
      setError("Código inválido. Verifica e intenta de nuevo.");
    }
  };

  return (
    <div className="page leagues-page">
      <div className="page-header">
        <h1>Ligas</h1>
        <p className="text-muted">Crea tu propia liga o únete a una existente</p>
      </div>

      <div className="leagues-actions">
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
          + Crear liga
        </button>
        <button className="btn btn-outline" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
          Unirse con código
        </button>
      </div>

      {showCreate && (
        <div className="inline-form">
          <input
            type="text"
            placeholder="Nombre de la liga"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>Crear</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowCreate(false)}>Cancelar</button>
        </div>
      )}

      {showJoin && (
        <div className="inline-form">
          <input
            type="text"
            placeholder="Código (ej: CHAMP24)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
            maxLength={8}
          />
          <button className="btn btn-primary btn-sm" onClick={handleJoin}>Unirse</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowJoin(false)}>Cancelar</button>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}

      <div className="leagues-grid">
        {store.leagues.map((league) => {
          const ranking = getLeagueRanking(store, league.id, allUsers);
          const currentUserRank = ranking.find((r) => r.id === "current_user");
          return (
            <LeagueCard
              key={league.id}
              league={league}
              memberCount={league.members.length}
              rank={currentUserRank?.rank}
              points={currentUserRank?.points}
            />
          );
        })}
      </div>

      {store.leagues.length === 0 && (
        <p className="empty-state">No estás en ninguna liga. Crea una o únete con un código.</p>
      )}
    </div>
  );
}
