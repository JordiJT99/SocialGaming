import { CircleDollarSign, Gamepad2, Gift, Smartphone, Ticket } from "lucide-react";

const REWARDS = [
  { id: "vip_pack", name: "Pack VIP", copy: "Boost de perfil y acceso prioritario a retos promocionales.", cost: 750, type: "digital", icon: Gift },
  { id: "steam_20", name: "Steam Wallet 20 EUR", copy: "Código digital para saldo gaming.", cost: 15000, type: "digital", icon: Ticket },
  { id: "amazon_5", name: "Tarjeta Amazon 5 EUR", copy: "Canje digital con entrega manual.", cost: 90000, type: "digital", icon: Ticket },
  { id: "spotify_1m", name: "Spotify Premium 1 mes", copy: "Código digital cuando haya stock del mes.", cost: 200000, type: "digital", icon: Smartphone },
  { id: "amazon_10", name: "Tarjeta Amazon 10 EUR", copy: "Recompensa alta para usuarios recurrentes.", cost: 190000, type: "digital", icon: Ticket },
  { id: "ps5", name: "PlayStation 5", copy: "Premio físico reservado para campañas cerradas.", cost: 450000, type: "physical", icon: Gamepad2, comingSoon: true },
];

function progress(current, cost) {
  return Math.min(100, Math.round((current / cost) * 100));
}

const EMPTY_ECONOMY = { redemptions: [] };

export default function Rewards({ economy, user, onRedeem }) {
  const currentCoins = user?.points || 0;
  const runRedeem = async (prize) => {
    try {
      await onRedeem(prize);
    } catch (error) {
      window.alert(error.message || "No se pudo canjear el premio");
    }
  };
  const redemptions = (economy || EMPTY_ECONOMY).redemptions.slice(0, 6);

  return (
    <div className="apex-page apex-rewards-page">
      <section className="apex-reward-intro">
        <h1>Tienda de recompensas</h1>
        <p>Canjea tus coins por premios digitales y guarda los premios físicos para campañas especiales.</p>
        <div>
          <span>Saldo actual<strong>{currentCoins.toLocaleString("es-ES")} Coins</strong></span>
          <span>Canjes hechos<strong>{redemptions.length}</strong></span>
        </div>
      </section>

      <nav className="apex-reward-filters">
        <button className="active">Todos</button>
        <button>Digitales</button>
        <button>Especiales</button>
      </nav>

      <section className="apex-reward-list">
        {REWARDS.map(({ id, name, copy, cost, type, icon: Icon, comingSoon }) => {
          const pct = progress(currentCoins, cost);
          const canRedeem = !comingSoon && currentCoins >= cost;
          return (
            <article key={id}>
              <div className="apex-reward-art">
                <Icon size={45} />
                {comingSoon && <b>PRÓXIMO</b>}
                {!comingSoon && pct >= 100 && <b>LISTO</b>}
              </div>
              <div>
                <h2>{name}</h2>
                <span><CircleDollarSign size={13} /> {cost.toLocaleString("es-ES")}</span>
              </div>
              <p>{copy}</p>
              <small>
                <span>{currentCoins.toLocaleString("es-ES")} / {cost.toLocaleString("es-ES")}</span>
                <em>{pct}%</em>
              </small>
              <i><u style={{ width: `${pct}%` }} /></i>
              <button
                type="button"
                disabled={!canRedeem}
                onClick={() => runRedeem({ id, name, cost, deliveryType: type })}
              >
                {comingSoon ? "Próximamente" : canRedeem ? "Canjear" : "Coins insuficientes"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="apex-recent-rewards">
        <h2>Actividad reciente</h2>
        {redemptions.length === 0 ? (
          <article>
            <Gift />
            <div>
              <strong>Aún no has canjeado premios</strong>
              <small>Completa ofertas y guarda coins para tu primer canje.</small>
            </div>
            <b>SIN HISTORIAL</b>
          </article>
        ) : redemptions.map((item) => (
          <article key={item.id}>
            <Gift />
            <div>
              <strong>{item.name}</strong>
              <small>{new Date(item.createdAt).toLocaleDateString("es-ES")} · {item.cost.toLocaleString("es-ES")} Coins</small>
            </div>
            <b>{item.status === "processing" ? "EN PROCESO" : "PENDIENTE"}</b>
          </article>
        ))}
      </section>
    </div>
  );
}
