import { useState } from "react";
import { Check, ChevronRight, Clock3, Coins, Gamepad2, Play, Smartphone, Sparkles, UserPlus } from "lucide-react";

const offers = [
  { id: 1, icon: Play, title: "Mira un video deportivo", provider: "Rewarded video", reward: 25, time: "30 segundos", tone: "blue" },
  { id: 2, icon: Smartphone, title: "Prueba una app de resultados", provider: "Oferta patrocinada", reward: 850, time: "5 minutos", tone: "green" },
  { id: 3, icon: Gamepad2, title: "Alcanza el nivel 5", provider: "Juego recomendado", reward: 2400, time: "3 dias", tone: "coral" },
  { id: 4, icon: UserPlus, title: "Completa un registro", provider: "Partner verificado", reward: 500, time: "2 minutos", tone: "gold" },
];

export default function Earn() {
  const [completed, setCompleted] = useState([]);
  return (
    <div className="product-page earn-page">
      <header className="product-hero earn-hero">
        <div><span className="product-eyebrow"><Coins size={15} /> Offerwall</span><h1>Gana monedas</h1><p>Completa tareas opcionales para acelerar tu progreso dentro de Playfulbet.</p></div>
        <div className="earn-balance"><span>Ganado este mes</span><strong>3.275 P</strong><small>Limite mensual: 10.000 P</small></div>
      </header>
      <section className="earn-daily panel">
        <div className="daily-streak-visual"><Sparkles size={25} /></div>
        <div><span className="product-eyebrow">Bonus diario</span><h2>Tu recompensa esta lista</h2><p>Vuelve cada dia para aumentar el bonus hasta 100 monedas.</p></div>
        <div className="earn-days">{[20, 30, 40, 60, 100].map((amount, index) => <span className={index < 3 ? "done" : ""} key={amount}>{index < 3 ? <Check size={13} /> : index + 1}<small>+{amount}</small></span>)}</div>
        <button className="classic-button">Reclamar +40 P</button>
      </section>
      <div className="offer-heading"><div><h2>Ofertas recomendadas</h2><p>Las recompensas pueden tardar unos minutos en aparecer.</p></div><div><button className="active">Todas</button><button>Rapidas</button><button>Mayor premio</button></div></div>
      <div className="offer-list">
        {offers.map(({ id, icon: Icon, title, provider, reward, time, tone }) => {
          const isCompleted = completed.includes(id);
          return (
            <article className="offer-row" key={id}>
              <span className={`offer-icon ${tone}`}><Icon size={22} /></span>
              <div className="offer-copy"><strong>{title}</strong><span>{provider}</span></div>
              <div className="offer-time"><Clock3 size={14} /> {time}</div>
              <div className="offer-reward"><span>Recompensa</span><strong>+{reward.toLocaleString("es-ES")} P</strong></div>
              <button className={isCompleted ? "completed" : ""} onClick={() => setCompleted((current) => isCompleted ? current : [...current, id])}>{isCompleted ? <Check size={16} /> : <ChevronRight size={17} />}</button>
            </article>
          );
        })}
      </div>
      <div className="offer-legal">Las tareas son opcionales y ofrecidas por terceros. Playfulbet nunca solicita pagos para completarlas.</div>
    </div>
  );
}
