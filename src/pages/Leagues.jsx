import { useState } from "react";
import { BriefcaseBusiness, ChevronRight, KeyRound, Medal, PlusCircle, TrendingDown, Trophy, Users } from "lucide-react";
import { createLeague, joinLeague } from "../data/store";

const RANKING = [
  ["Carlos M.", "Racha: 5🔥", "2,450", "+120", "gold"],
  ["Tú (Jordi)", "Subiendo...", "2,380", "+450", "self"],
  ["Juan K.", "Consistente", "2,210", "-15", "bronze"],
  ["Ana Smith", "", "1,980", "--", ""],
  ["Lucas G.", "", "1,820", "-210", ""],
];

export default function Leagues({ store, onStoreChange }) {
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    if (mode === "create") createLeague(store, value.trim());
    if (mode === "join") joinLeague(store, value.trim().toUpperCase());
    onStoreChange();
    setMode(null);
    setValue("");
  };

  return (
    <div className="apex-page apex-leagues-page">
      <section className="apex-league-actions">
        <button onClick={() => setMode("create")}><PlusCircle /><strong>Crear Liga</strong></button>
        <button onClick={() => setMode("join")}><KeyRound /><strong>Unirse con Código</strong></button>
      </section>
      {mode && <div className="apex-inline-action"><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder={mode === "create" ? "Nombre de la liga" : "Código de invitación"} /><button onClick={submit}>Confirmar</button></div>}

      <section className="apex-my-leagues">
        <div><h2>Mis Ligas</h2><button>Ver todas</button></div>
        <aside>
          <article className="active"><Users /><b>12/20</b><h3>{store.leagues[0]?.name || "Liga de Amigos"}</h3><small>PUESTO: 2º DE 12</small></article>
          <article><BriefcaseBusiness /><b>45/50</b><h3>Oficina Pro</h3><small>PUESTO: 14º DE 45</small></article>
        </aside>
      </section>

      <section className="apex-social-alert"><span><TrendingDown /></span><p><strong>Juan</strong> te ha superado en <b>Liga de Amigos.</b></p><ChevronRight /></section>

      <section className="apex-league-ranking">
        <i className="handle" />
        <header><div><h2>Liga de Amigos</h2><span>Temporada 4 · Semana 12</span></div><b><Trophy size={15} /> Piscina: 1,200</b></header>
        <div className="apex-league-ranks">
          {RANKING.map(([name, status, score, change, tone], index) => (
            <article className={tone} key={name}>
              <span className="rank">{index < 3 ? <Medal /> : index + 1}</span>
              <span className="rank-avatar">{name.slice(0, 1)}</span>
              <div><strong>{name}</strong><small>{status}</small></div>
              <aside><b>{score}</b><small className={change.startsWith("-") ? "down" : ""}>{change}</small></aside>
            </article>
          ))}
        </div>
        <button className="apex-full-ranking">VER CLASIFICACIÓN COMPLETA</button>
      </section>
    </div>
  );
}
