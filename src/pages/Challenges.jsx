import { useEffect, useState } from "react";
import { CalendarClock, Check, ChevronRight, Flame, LockKeyhole, Medal, Trophy, Users } from "lucide-react";

const challenges = [
  { id: 1, type: "Torneo", title: "Rey de LaLiga", text: "Acierta mas resultados que el resto durante la jornada 24.", entry: 500, prize: "25.000 P", players: "642/1.000", progress: 64, color: "green" },
  { id: 2, type: "Reto diario", title: "Triplete perfecto", text: "Encadena tres pronosticos correctos en partidos de hoy.", entry: 0, prize: "750 P", players: "1.284 jugando", progress: 33, color: "blue" },
  { id: 3, type: "Torneo premium", title: "Noche de Champions", text: "Clasificacion especial con los ocho partidos de Champions.", entry: 1200, prize: "Camiseta oficial", players: "184/250", progress: 74, color: "gold" },
  { id: 4, type: "Reto social", title: "Invita y compite", text: "Crea una liga y consigue que se unan tres amigos.", entry: 0, prize: "1.500 P", players: "2 de 3 amigos", progress: 66, color: "coral" },
];

function useCountdown(targetDate) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetDate - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetDate - Date.now()));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return remaining;
}

function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function Challenges() {
  const [joined, setJoined] = useState([2]);
  const target = new Date();
  target.setDate(target.getDate() + 1);
  target.setHours(target.getHours() + 6, 42, 0, 0);
  const remaining = useCountdown(target.getTime());
  const isUrgent = remaining < 3 * 60 * 60 * 1000;

  return (
    <div className="product-page challenges-page">
      <header className="product-hero challenge-hero">
        <div><span className="product-eyebrow"><Flame size={15} /> Competiciones activas</span><h1>Desafios y torneos</h1><p>Usa tus monedas para entrar, completa objetivos y escala la clasificacion.</p></div>
        <div className={`challenge-countdown ${isUrgent ? "urgent" : ""}`}><CalendarClock size={22} /><div><span>La jornada termina en</span><strong>{formatCountdown(remaining)}</strong></div></div>
      </header>
      <div className="challenge-stats">
        <div><Trophy size={20} /><span>Torneos jugados</span><strong>14</strong></div>
        <div><Medal size={20} /><span>Mejor posicion</span><strong>#8</strong></div>
        <div><Flame size={20} /><span>Racha de retos</span><strong>5 dias</strong></div>
      </div>
      <div className="challenge-grid">
        {challenges.map((challenge) => {
          const isJoined = joined.includes(challenge.id);
          return (
            <article className={`challenge-card ${challenge.color}`} key={challenge.id}>
              <div className="challenge-top"><span>{challenge.type}</span>{challenge.entry > 0 ? <b>{challenge.entry} P entrada</b> : <b>Gratis</b>}</div>
              <div className="challenge-symbol">{challenge.id === 3 ? <LockKeyhole /> : challenge.id === 4 ? <Users /> : <Trophy />}</div>
              <h2>{challenge.title}</h2><p>{challenge.text}</p>
              <div className="challenge-prize"><span>Premio</span><strong>{challenge.prize}</strong></div>
              <div className="challenge-progress"><div><span>{challenge.players}</span><b>{challenge.progress}%</b></div><div><i style={{ width: `${challenge.progress}%` }} /></div></div>
              <button className={isJoined ? "joined" : ""} onClick={() => setJoined((current) => isJoined ? current.filter((id) => id !== challenge.id) : [...current, challenge.id])}>{isJoined ? <><Check size={15} /> Inscrito</> : <>Participar <ChevronRight size={15} /></>}</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
