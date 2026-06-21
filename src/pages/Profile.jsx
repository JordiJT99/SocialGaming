import { Edit3, Flame, Medal, Plus, Target, Trophy } from "lucide-react";

export default function Profile({ user }) {
  return (
    <div className="apex-page apex-profile-page">
      <section className="apex-profile-hero">
        <div><span className="apex-profile-monogram">{user?.username?.slice(0, 2).toUpperCase() || "JO"}</span><b>24</b></div>
        <h1>{user?.username || "Adrian Vega"}</h1>
        <p>◉ Analista Pro · Miembro desde 2023</p>
        <button><Edit3 size={19} /> Editar Perfil</button>
      </section>
      <section className="apex-profile-stats">
        <article><span>ACIERTO</span><strong>{user?.accuracy || "68.4"} %</strong></article>
        <article><span>RACHA<br />ACTUAL</span><strong className="streak">W{user?.streak || 5} <i /><i /><i /></strong></article>
        <article><span>PREDICCIONES</span><strong>{user?.predictionsCount || "1,248"}</strong></article>
        <article><span>ROI</span><strong>+12.4 %</strong></article>
      </section>
      <section className="apex-achievements">
        <h2>Vitrina de Logros</h2>
        <div><article><span><Medal /></span><b>Elite</b></article><article className="locked"><span><Trophy /></span><b>100 Wins</b></article><article><span><Flame /></span><b>On Fire</b></article><article><span><Target /></span><b>Oracle</b></article><article className="add"><span><Plus /></span></article></div>
      </section>
      <section className="apex-history">
        <div><h2>Historial Reciente</h2><button>Ver Todo</button></div>
        <article className="won"><span>⚽</span><div><strong>Real Madrid vs FC Barcelona</strong><small>Resultado Final: Real Madrid Win</small></div><aside><b>GANADO</b><em>+142.50 Coins</em></aside></article>
        <article className="lost"><span>◉</span><div><strong>Lakers vs Celtics</strong><small>Over 220.5 Puntos</small></div><aside><b>PERDIDO</b><em>-50.00 Coins</em></aside></article>
        <article className="won"><span>🎾</span><div><strong>Nadal vs Djokovic</strong><small>Nadal Gana 2-1</small></div><aside><b>GANADO</b><em>+88.20 Coins</em></aside></article>
      </section>
    </div>
  );
}
