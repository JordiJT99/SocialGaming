import { Filter, Search, Trophy } from "lucide-react";

const USERS = [
  ["CryptoBettor", "PRO", "11,420"],
  ["GoalGetter99", "AMATEUR", "10,850"],
  ["DataDynamo", "PRO", "9,200"],
  ["Tú (ApexUser)", "MVP CANDIDATE", "8,750"],
  ["WinMaster", "AMATEUR", "8,100"],
];

export default function Ranking() {
  return (
    <div className="apex-page apex-ranking-page">
      <header><h1>Ranking Global</h1><p>Los mejores pronosticadores de la temporada</p></header>
      <section className="apex-podium">
        <article><span>ES</span><b>2º</b><strong>EliteSniper</strong><small>14,250 pts</small></article>
        <article className="winner"><Trophy /><span>AP</span><b>GANADOR</b><strong>AlphaProphet</strong><small>18,900 pts</small></article>
        <article><span>SK</span><b>3º</b><strong>StatsKing</strong><small>12,800 pts</small></article>
      </section>
      <label className="apex-user-search"><Search /><input placeholder="Buscar usuario..." /></label>
      <button className="apex-season-button"><Filter /> Temporada</button>
      <section className="apex-ranking-table">
        <header><span>POS</span><span>USUARIO</span><span>PUNTOS</span></header>
        {USERS.map(([name, level, points], index) => <article className={index === 3 ? "current" : ""} key={name}><b>{index + 4}</b><span className="user-avatar">{name.slice(0, 1)}</span><div><strong>{name}</strong><small>{level}</small></div><em>{points}</em></article>)}
      </section>
    </div>
  );
}
