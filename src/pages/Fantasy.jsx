import { Bolt, Settings, Shield, UserPlus } from "lucide-react";

const CLUBS = {
  real: { name: "Real Madrid", crest: "/crests/real-madrid.svg", kit: "#f5f2df", accent: "#b89b45" },
  city: { name: "Manchester City", crest: "/crests/man-city.png", kit: "#6cabdd", accent: "#1c2c5b" },
  liverpool: { name: "Liverpool", crest: "/crests/liverpool.png", kit: "#c8102e", accent: "#00b2a9" },
  barca: { name: "Barcelona", crest: "/crests/barcelona.svg", kit: "#004d98", accent: "#a50044" },
  arsenal: { name: "Arsenal", crest: "/crests/arsenal.png", kit: "#ef0107", accent: "#f4f4f4" },
  inter: { name: "Inter", crest: "/crests/inter.png", kit: "#0068a8", accent: "#111111" },
};

const PLAYERS = [
  { name: "Vini Jr.", points: 14, rating: 99, number: 7, club: CLUBS.real },
  { name: "Haaland", points: 8, rating: 82, number: 9, club: CLUBS.city },
  { name: "Salah", points: 2, rating: 45, number: 11, club: CLUBS.liverpool },
  { name: "Bellingham", points: 6, number: 5, club: CLUBS.real },
  { name: "De Bruyne", points: 10, number: 17, club: CLUBS.city },
  { name: "Rodri", points: 3, number: 16, club: CLUBS.city },
  { name: "Van Dijk", points: 5, number: 4, club: CLUBS.liverpool },
  { name: "Araujo", points: 7, number: 4, club: CLUBS.barca },
  { name: "Walker", points: 2, number: 2, club: CLUBS.city },
  { name: "Davies", points: 4, number: 19, club: CLUBS.inter },
  { name: "Ter Stegen", points: 9, number: 1, club: CLUBS.barca },
];

const BENCH = [
  { name: "Courtois", pos: "POR", number: 1, club: CLUBS.real },
  { name: "Kimmich", pos: "MED", number: 6, club: CLUBS.inter },
  { name: "Foden", pos: "DEL", number: 47, club: CLUBS.city },
];

function Kit({ player, keeper = false }) {
  return (
    <span
      className={`apex-player-kit ${keeper ? "keeper" : ""}`}
      style={{ "--kit": player.club.kit, "--kit-accent": player.club.accent }}
      title={`${player.name} · ${player.club.name}`}
    >
      {keeper && <i><Shield size={13} /></i>}
      <img src={player.club.crest} alt="" />
      <em>{player.number}</em>
      {player.rating && <b>{player.rating}</b>}
    </span>
  );
}

function Player({ player, keeper }) {
  return (
    <div className={`apex-fantasy-player ${keeper ? "keeper" : ""}`}>
      <Kit player={player} keeper={keeper} />
      <div><strong>{player.name}</strong><small>{player.points} pts</small></div>
    </div>
  );
}

export default function Fantasy() {
  return (
    <div className="apex-page apex-fantasy-page">
      <nav className="apex-subtabs"><button className="active">Mi Equipo</button><button>Mercado</button><button>Estadísticas</button><button>Premios</button></nav>
      <section className="apex-fantasy-heading">
        <h1>Mi Equipo</h1><div><span>JORNADA 24</span><b>En vivo</b></div>
        <aside><article><small>VALORACIÓN</small><strong>124 PTS</strong></article><article><i>2</i><small>CAMBIOS</small><strong>Libres</strong></article></aside>
      </section>
      <section className="apex-pitch">
        <i className="center-line" /><i className="center-circle" />
        <div className="formation three">{PLAYERS.slice(0, 3).map((player) => <Player key={player.name} player={player} />)}</div>
        <div className="formation three">{PLAYERS.slice(3, 6).map((player) => <Player key={player.name} player={player} />)}</div>
        <div className="formation four">{PLAYERS.slice(6, 10).map((player) => <Player key={player.name} player={player} />)}</div>
        <div className="formation one"><Player player={PLAYERS[10]} keeper /></div>
      </section>
      <section className="apex-bench">
        <div><h2>Banquillo</h2><button>Gestionar <Settings size={17} /></button></div>
        <aside>
          {BENCH.map((player) => <article key={player.name}><Kit player={player} /><strong>{player.name}</strong><small>{player.pos}</small></article>)}
          <article className="add"><UserPlus /><small>FICHAR</small></article>
        </aside>
      </section>
      <button className="apex-fab" aria-label="Accion fantasy"><Bolt size={28} /></button>
    </div>
  );
}
