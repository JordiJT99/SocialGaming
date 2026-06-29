import { CheckCircle2, Circle, CircleDollarSign, ClipboardCheck, ShieldCheck } from "lucide-react";

const OFFERS = [
  { id: "survey_profile", title: "Encuesta de perfil", copy: "Cuéntanos qué deportes sigues para personalizar retos y mercado.", reward: 250, action: "Completar", icon: ClipboardCheck },
  { id: "install_partner", title: "War Legends", copy: "Instala la app patrocinada y abre el juego una vez.", reward: 1200, action: "Instalar", image: "WL" },
  { id: "newsletter_optin", title: "Club Playfulbet", copy: "Activa avisos de torneos y premios para recibir campañas privadas.", reward: 400, action: "Activar", icon: ShieldCheck },
];

const EMPTY_ECONOMY = {
  streak: 0,
  dailyAvailable: true,
  dailyReward: 25,
  videoClaimsToday: 0,
  videoClaimsRemaining: 5,
  videoReward: 15,
  completedOffers: [],
  currentCoins: 0,
};

export default function Earn({ economy, user, onClaimDaily, onClaimVideo, onCompleteOffer }) {
  const rewardStatus = { ...EMPTY_ECONOMY, ...(economy || {}), currentCoins: user?.points || 0 };
  const completedOffers = new Set(rewardStatus.completedOffers || []);
  const runAction = async (action) => {
    try {
      await action();
    } catch (error) {
      window.alert(error.message || "No se pudo completar la acción");
    }
  };
  const missionsCompleted = [
    !rewardStatus.dailyAvailable,
    rewardStatus.videoClaimsToday >= 3,
    completedOffers.has("survey_profile"),
  ].filter(Boolean).length;

  return (
    <div className="apex-page apex-earn-page">
      <header>
        <h1>Centro de recompensas</h1>
        <p>Completa acciones promocionales para sumar coins sin depender de los resultados deportivos.</p>
      </header>

      <section className="apex-daily-missions apex-card">
        <div>
          <h2><ClipboardCheck /> Misiones diarias</h2>
          <span>{missionsCompleted}/3 completado</span>
        </div>
        <span className="apex-progress"><i style={{ width: `${(missionsCompleted / 3) * 100}%` }} /></span>

        <article className={rewardStatus.dailyAvailable ? "pending" : ""}>
          {rewardStatus.dailyAvailable ? <Circle /> : <CheckCircle2 />}
          <div>
            <strong>Bonus diario</strong>
            <small>+{rewardStatus.dailyReward} Coins por la siguiente racha</small>
          </div>
          <button type="button" onClick={() => runAction(onClaimDaily)} disabled={!rewardStatus.dailyAvailable}>
            {rewardStatus.dailyAvailable ? "Reclamar" : "Reclamado"}
          </button>
        </article>

        <article className={rewardStatus.videoClaimsRemaining > 0 ? "pending" : ""}>
          {rewardStatus.videoClaimsRemaining > 0 ? <Circle /> : <CheckCircle2 />}
          <div>
            <strong>Videos recompensados</strong>
            <small>{rewardStatus.videoClaimsToday}/{5} vistos hoy · +{rewardStatus.videoReward} Coins cada uno</small>
          </div>
          <button type="button" onClick={() => runAction(onClaimVideo)} disabled={rewardStatus.videoClaimsRemaining === 0}>
            {rewardStatus.videoClaimsRemaining > 0 ? `Ver video +${rewardStatus.videoReward}` : "Límite alcanzado"}
          </button>
        </article>

        <article className={completedOffers.has("survey_profile") ? "" : "pending"}>
          {completedOffers.has("survey_profile") ? <CheckCircle2 /> : <Circle />}
          <div>
            <strong>Activa una oferta</strong>
            <small>Completa una encuesta o patrocinio para desbloquear más saldo</small>
          </div>
          <button
            type="button"
            onClick={() => runAction(() => onCompleteOffer(OFFERS[0]))}
            disabled={completedOffers.has("survey_profile")}
          >
            {completedOffers.has("survey_profile") ? "Completada" : "Completar"}
          </button>
        </article>
      </section>

      <section className="apex-featured-offers">
        <h2>Ofertas destacadas</h2>
        {OFFERS.map(({ id, title, copy, reward, action, icon: Icon, image }) => {
          const completed = completedOffers.has(id);
          return (
            <article key={id}>
              <span className={image ? "game-art" : ""}>{image || <Icon />}</span>
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
              <b><CircleDollarSign /> {reward.toLocaleString("es-ES")}</b>
              <button type="button" onClick={() => runAction(() => onCompleteOffer({ id, title, reward }))} disabled={completed}>
                {completed ? "Completada" : action}
              </button>
            </article>
          );
        })}
      </section>

      <section className="apex-offerwalls">
        <div><h2>Resumen de actividad</h2><button type="button">Saldo: {rewardStatus.currentCoins.toLocaleString("es-ES")} coins</button></div>
        <header><span>CANAL</span><span>ESTADO</span><span>VALOR</span></header>
        {[
          ["D", "Racha diaria", rewardStatus.dailyAvailable ? "Disponible" : "Cobrada", `+${rewardStatus.dailyReward}`],
          ["V", "Video recompensado", `${rewardStatus.videoClaimsToday}/5 hoy`, `+${rewardStatus.videoReward}`],
          ["O", "Ofertas", `${completedOffers.size} completadas`, "+hasta 1.2k"],
        ].map((row) => (
          <article key={row[1]}>
            <b>{row[0]}</b>
            <strong>{row[1]}</strong>
            <span>{row[2]}</span>
            <em>{row[3]}</em>
          </article>
        ))}
      </section>
    </div>
  );
}
