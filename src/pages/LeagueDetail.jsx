import { useParams, Link } from "react-router-dom";
import RankingTable from "../components/RankingTable";
import { getLeagueRanking } from "../data/store";

export default function LeagueDetail({ store, allUsers }) {
  const { leagueId } = useParams();
  const league = store.leagues.find((l) => l.id === leagueId);

  if (!league) {
    return (
      <div className="page">
        <h1>Liga no encontrada</h1>
        <Link to="/leagues" className="btn btn-outline">Volver a ligas</Link>
      </div>
    );
  }

  const ranking = getLeagueRanking(store, league.id, allUsers);

  return (
    <div className="page league-detail">
      <div className="page-header">
        <Link to="/leagues" className="back-link">← Volver a ligas</Link>
        <h1>{league.name}</h1>
        <p className="text-muted">Código: <strong>{league.code}</strong> — {league.members.length} miembros</p>
      </div>

      <div className="section-header">
        <h2>Clasificación</h2>
      </div>
      <RankingTable rows={ranking} />
    </div>
  );
}
