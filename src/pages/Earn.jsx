import { CheckCircle2, Circle, CircleDollarSign, CircleHelp, ClipboardCheck, PlayCircle } from "lucide-react";

const OFFERS = [
  { title: "Video Rápido", copy: "Mira un anuncio de 30 segundos.", reward: "15", action: "Ver Ahora", icon: PlayCircle },
  { title: "War Legends", copy: "Instala y alcanza el nivel 5.", reward: "1,200", action: "Instalar", image: true },
  { title: "Encuesta de Perfil", copy: "Ayúdanos a conocer tus deportes favoritos.", reward: "250", action: "Comenzar", icon: CircleHelp },
];

export default function Earn() {
  return (
    <div className="apex-page apex-earn-page">
      <header><h1>Centro de Recompensas</h1><p>Completa tareas rápidas para aumentar tu saldo de monedas Apex.</p></header>
      <section className="apex-daily-missions apex-card">
        <div><h2><ClipboardCheck /> Misiones Diarias</h2><span>2/3 Completado</span></div>
        <span className="apex-progress"><i style={{ width: "66%" }} /></span>
        <article><CheckCircle2 /><div><strong>Login Diario</strong><small>+10 Coins</small></div></article>
        <article><CheckCircle2 /><div><strong>Ver 3 Anuncios</strong><small>+25 Coins</small></div></article>
        <article className="pending"><Circle /><div><strong>Ganar 1 Predicción</strong><small>+50 Coins</small></div></article>
      </section>
      <section className="apex-featured-offers">
        <h2>Ofertas Destacadas</h2>
        {OFFERS.map(({ title, copy, reward, action, icon: Icon, image }) => (
          <article key={title}>
            <span className={image ? "game-art" : ""}>{image ? "WL" : <Icon />}</span>
            <div><strong>{title}</strong><p>{copy}</p></div>
            <b><CircleDollarSign /> {reward}</b>
            <button>{action}</button>
          </article>
        ))}
      </section>
      <section className="apex-offerwalls">
        <div><h2>Muros de Ofertas</h2><button>Ver todos ›</button></div>
        <header><span>PROVEEDOR</span><span>TIPO</span><span>PREMIO MÁX.</span></header>
        {[["A", "AdGate Media", "Multi-tarea", "+50k"], ["I", "IronSource", "Descargas", "+120k"], ["T", "TapJoy", "Encuestas", "+25k"]].map((row) => <article key={row[1]}><b>{row[0]}</b><strong>{row[1]}</strong><span>{row[2]}</span><em>● {row[3]}</em></article>)}
      </section>
    </div>
  );
}
