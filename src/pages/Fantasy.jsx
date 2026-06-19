import { useState } from "react";
import { ArrowRightLeft, CalendarDays, ChevronDown, Shield, Star, Trophy, Users } from "lucide-react";

const players = [
  { id: 1, name: "L. Martinez", team: "Inter", pos: "DEL", price: 18.5, points: 82, color: "#1166a8" },
  { id: 2, name: "J. Bellingham", team: "Real Madrid", pos: "MED", price: 17.2, points: 91, color: "#7152b8" },
  { id: 3, name: "Pedri", team: "Barcelona", pos: "MED", price: 14.8, points: 74, color: "#b51655" },
  { id: 4, name: "A. Griezmann", team: "Atletico", pos: "DEL", price: 16.4, points: 79, color: "#db303a" },
  { id: 5, name: "A. Bastoni", team: "Inter", pos: "DEF", price: 10.2, points: 68, color: "#1372a8" },
];

const lineup = [
  { name: "Raya", pos: "POR", left: "50%", top: "83%" },
  { name: "Carvajal", pos: "DEF", left: "18%", top: "64%" },
  { name: "Bastoni", pos: "DEF", left: "50%", top: "68%" },
  { name: "Theo", pos: "DEF", left: "82%", top: "64%" },
  { name: "Pedri", pos: "MED", left: "24%", top: "39%" },
  { name: "Bellingham", pos: "MED", left: "50%", top: "46%" },
  { name: "Rodri", pos: "MED", left: "76%", top: "39%" },
  { name: "Vinicius", pos: "DEL", left: "25%", top: "16%" },
  { name: "Lautaro", pos: "DEL", left: "50%", top: "11%" },
  { name: "Griezmann", pos: "DEL", left: "75%", top: "16%" },
];

export default function Fantasy() {
  const [tab, setTab] = useState("equipo");
  const [captain, setCaptain] = useState("Bellingham");

  return (
    <div className="product-page fantasy-page">
      <header className="product-hero">
        <div>
          <span className="product-eyebrow"><Shield size={15} /> Fantasy semanal</span>
          <h1>Tu equipo, tus decisiones</h1>
          <p>Construye un once con jugadores reales y compite por su rendimiento cada jornada.</p>
        </div>
        <div className="hero-metric"><strong>#184</strong><span>clasificacion global</span></div>
      </header>

      <nav className="product-tabs">
        <button className={tab === "equipo" ? "active" : ""} onClick={() => setTab("equipo")}>Mi equipo</button>
        <button className={tab === "mercado" ? "active" : ""} onClick={() => setTab("mercado")}>Mercado</button>
        <button className={tab === "ligas" ? "active" : ""} onClick={() => setTab("ligas")}>Ligas fantasy</button>
      </nav>

      <div className="fantasy-layout">
        <section className="panel fantasy-pitch-panel">
          <div className="panel-heading">
            <div><h2>Jordi XI</h2><span><CalendarDays size={13} /> Jornada 24</span></div>
            <button className="icon-text-button"><ArrowRightLeft size={15} /> Editar equipo</button>
          </div>
          <div className="fantasy-pitch">
            <div className="pitch-box" />
            <div className="pitch-circle-mark" />
            {lineup.map((player) => (
              <button
                className={`fantasy-player ${captain === player.name ? "captain" : ""}`}
                style={{ left: player.left, top: player.top }}
                type="button"
                key={player.name}
                onClick={() => setCaptain(player.name)}
                title="Elegir capitan"
              >
                <span>{player.name.slice(0, 2).toUpperCase()}</span>
                <b>{player.name}</b>
                {captain === player.name && <small>C</small>}
              </button>
            ))}
          </div>
          <div className="budget-strip">
            <div><span>Valor del equipo</span><strong>94,2 M</strong></div>
            <div><span>Presupuesto</span><strong>5,8 M</strong></div>
            <div><span>Puntos jornada</span><strong>72</strong></div>
          </div>
        </section>

        <aside className="fantasy-side">
          <section className="panel">
            <div className="panel-heading"><h2>Jugadores en forma</h2><ChevronDown size={16} /></div>
            <div className="player-market-list">
              {players.map((player) => (
                <div className="market-player" key={player.id}>
                  <span className="market-avatar" style={{ background: player.color }}>{player.name[0]}</span>
                  <div><strong>{player.name}</strong><span>{player.pos} · {player.team}</span></div>
                  <div><b>{player.points} pts</b><span>{player.price} M</span></div>
                  <button type="button">+</button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel mini-league-card">
            <div className="mini-icon"><Users size={22} /></div>
            <div><span>Tu liga principal</span><h3>La Peña Champions</h3><p>Vas 3º de 12 jugadores</p></div>
            <Trophy size={22} />
          </section>
          <section className="captain-note">
            <Star size={17} />
            <p><strong>{captain}</strong> es tu capitan y suma puntuacion doble.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
