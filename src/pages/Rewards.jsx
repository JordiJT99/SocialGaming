import { useState } from "react";
import { Check, Gift, Heart, Package, Search, Shirt, ShoppingBag, Sparkles, Ticket, Trophy } from "lucide-react";

const rewards = [
  { id: 1, category: "Sorteos", name: "Sorteo camiseta de tu equipo", cost: 750, stock: "Termina en 2 dias", icon: Shirt, tone: "coral", featured: true },
  { id: 2, category: "Gift cards", name: "Tarjeta regalo 10 €", cost: 15000, stock: "24 disponibles", icon: Gift, tone: "green" },
  { id: 3, category: "Merchandising", name: "Bufanda Playfulbet", cost: 8500, stock: "Stock limitado", icon: Package, tone: "blue" },
  { id: 4, category: "Sorteos", name: "Entradas partido LaLiga", cost: 1500, stock: "Termina en 5 dias", icon: Ticket, tone: "gold" },
  { id: 5, category: "Merchandising", name: "Balon oficial", cost: 22000, stock: "8 disponibles", icon: Trophy, tone: "violet" },
  { id: 6, category: "Gift cards", name: "Suscripcion deportiva", cost: 25000, stock: "Digital", icon: Sparkles, tone: "navy" },
];

export default function Rewards({ user }) {
  const [filter, setFilter] = useState("Todos");
  const [favorite, setFavorite] = useState([]);
  const [redeemed, setRedeemed] = useState(null);
  const visible = filter === "Todos" ? rewards : rewards.filter((reward) => reward.category === filter);

  return (
    <div className="product-page rewards-page">
      <header className="product-hero rewards-hero">
        <div><span className="product-eyebrow"><ShoppingBag size={15} /> Tienda de recompensas</span><h1>Juega. Suma. Disfruta.</h1><p>Usa tus monedas en sorteos, merchandising y recompensas patrocinadas.</p></div>
        <div className="reward-balance"><span>Tu saldo</span><strong>{user?.points?.toLocaleString("es-ES") || "1.500"} P</strong><small>Las monedas no tienen valor monetario</small></div>
      </header>
      <div className="reward-toolbar">
        <div className="reward-filters">{["Todos", "Sorteos", "Gift cards", "Merchandising"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
        <label className="reward-search"><Search size={16} /><input placeholder="Buscar recompensa" /></label>
      </div>
      <div className="reward-grid">
        {visible.map(({ id, category, name, cost, stock, icon: Icon, tone, featured }) => {
          const isFavorite = favorite.includes(id);
          return (
            <article className={`reward-card ${featured ? "featured" : ""}`} key={id}>
              <div className={`reward-art ${tone}`}><Icon size={54} strokeWidth={1.5} />{featured && <span>Destacado</span>}<button onClick={() => setFavorite((current) => isFavorite ? current.filter((item) => item !== id) : [...current, id])}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} /></button></div>
              <div className="reward-card-body"><span>{category}</span><h2>{name}</h2><p>{stock}</p><div><strong>{cost.toLocaleString("es-ES")} P</strong><button onClick={() => setRedeemed(id)} disabled={(user?.points || 1500) < cost}>{redeemed === id ? <Check size={16} /> : cost <= (user?.points || 1500) ? "Canjear" : "Te faltan monedas"}</button></div></div>
            </article>
          );
        })}
      </div>
      <section className="reward-explainer"><div><Gift size={24} /><h3>Premios no lineales</h3><p>El coste en puntos no equivale al precio del producto.</p></div><div><Ticket size={24} /><h3>Sorteos transparentes</h3><p>Cada participacion muestra fecha y condiciones.</p></div><div><Package size={24} /><h3>Stock patrocinado</h3><p>La disponibilidad depende de campañas y partners.</p></div></section>
    </div>
  );
}
