import { CircleDollarSign, Gift, Smartphone, Ticket, Gamepad2 } from "lucide-react";

const REWARDS = [
  ["Amazon Gift Card $50", "Código digital instantáneo", "5,000", "11%", Ticket],
  ["PlayStation 5 Console", "Envío físico nacional", "45,000", "1.2%", Gamepad2],
  ["Steam Wallet $20", "Crédito para juegos", "2,000", "27%", Ticket],
  ["iPhone 15 Pro Max", "Último modelo 256GB", "95,000", "0.5%", Smartphone],
  ["Nike Voucher $100", "Canjeable en tienda oficial", "10,000", "5.4%", Ticket],
  ["Pack de Inicio VIP", "Boost de cuotas + 200 monedas", "750", "72%", Gift],
];

export default function Rewards() {
  return (
    <div className="apex-page apex-rewards-page">
      <section className="apex-reward-intro">
        <h1>Tienda de Recompensas</h1><p>Canjea tus ganancias por premios exclusivos. Sigue apostando para alcanzar tus objetivos.</p>
        <div><span>NIVEL<strong>Elite III</strong></span><span>RACHA<strong>12 Días</strong></span></div>
      </section>
      <nav className="apex-reward-filters"><button className="active">Todos</button><button>Tecnología</button><button>Gift Cards</button></nav>
      <section className="apex-reward-list">
        {REWARDS.map(([name, copy, cost, progress, Icon], index) => (
          <article key={name}>
            <div className="apex-reward-art"><Icon size={45} />{index === 0 && <b>POPULAR</b>}{index === 5 && <b>CASI TUYO</b>}</div>
            <div><h2>{name}</h2><span><CircleDollarSign size={13} /> {cost}</span></div>
            <p>{copy}</p><small>Progreso: 540 / {cost}<em>{progress}</em></small><i><u style={{ width: progress }} /></i>
            <button disabled={index !== 5}>{index === 5 ? "Seguir ganando" : "Monedas insuficientes"}</button>
          </article>
        ))}
      </section>
      <section className="apex-recent-rewards"><h2>Actividad Reciente</h2><article><Gift /><div><strong>Spotify Premium 1 Mes</strong><small>14 Oct, 2023</small></div><b>ENTREGADO</b></article><article><Gamepad2 /><div><strong>League of Legends RP</strong><small>02 Oct, 2023</small></div><b>ENTREGADO</b></article></section>
    </div>
  );
}
