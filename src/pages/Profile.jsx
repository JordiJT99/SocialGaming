import { Edit3, Flame, Medal, Plus, Target, Trophy } from "lucide-react";

function MatchName({ item, matches }) {
  const match = matches?.find((candidate) => candidate.id === item.matchId);
  const home = item.home || match?.home;
  const away = item.away || match?.away;
  const homeBadge = item.homeBadge || match?.homeBadge;
  const awayBadge = item.awayBadge || match?.awayBadge;

  return (
    <span className="apex-history-match">
      {homeBadge && <img src={homeBadge} alt="" />}
      <strong>{home && away ? `${home} vs ${away}` : item.matchId}</strong>
      {awayBadge && <img src={awayBadge} alt="" />}
    </span>
  );
}

export default function Profile({ store, user, matches, onAcceptPendingChange, onCancelPendingChange }) {
  const predictions = store?.predictions?.filter((item) => item.userId === "current_user") || [];
  const pendingItems = predictions.filter((item) => ["pending_quote", "needs_confirmation"].includes(item.status));
  const recentItems = predictions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const statusLabel = (status) => ({
    pending: "ACTIVA",
    pending_quote: "VALIDANDO",
    needs_confirmation: "CONFIRMAR",
    cancelled: "CANCELADA",
    won: "GANADA",
    lost: "PERDIDA",
  }[status] || status.toUpperCase());
  const selectionLabel = (item) => item.selection === "1"
    ? item.home
    : item.selection === "2"
      ? item.away
      : "Empate";

  return (
    <div className="apex-page apex-profile-page">
      <section className="apex-profile-hero">
        <div><span className="apex-profile-monogram">{user?.username?.slice(0, 2).toUpperCase() || "JO"}</span><b>24</b></div>
        <h1>{user?.username || "Adrian Vega"}</h1>
        <p>◉ Analista Pro · Miembro desde 2023</p>
        <button><Edit3 size={19} /> Editar Perfil</button>
      </section>
      <section className="apex-profile-stats">
        <article><span>ACIERTO</span><strong>{user?.accuracy || 0} %</strong></article>
        <article><span>RACHA<br />ACTUAL</span><strong className="streak">W{user?.streak || 0} <i /><i /><i /></strong></article>
        <article><span>PREDICCIONES</span><strong>{user?.predictionsCount || 0}</strong></article>
        <article><span>PENDIENTES</span><strong>{pendingItems.length}</strong></article>
      </section>
      <section className="apex-achievements">
        <h2>Vitrina de Logros</h2>
        <div><article><span><Medal /></span><b>Elite</b></article><article className="locked"><span><Trophy /></span><b>100 Wins</b></article><article><span><Flame /></span><b>On Fire</b></article><article><span><Target /></span><b>Oracle</b></article><article className="add"><span><Plus /></span></article></div>
      </section>
      <div className="apex-profile-history-column">
        <section className="apex-history">
          <div><h2>Pendientes de cuota</h2><button>{pendingItems.length}</button></div>
          <p className="apex-quote-rule">Si la cuota lleva más de 5 minutos sin revisarse, quedará pendiente. Un cambio de hasta 0,20 se acepta automáticamente; si es mayor, tendrás que confirmarlo aquí.</p>
          {pendingItems.length === 0 && <article className="empty"><div><strong>No hay cuotas pendientes</strong><small>Las apuestas que necesiten validacion apareceran aqui.</small></div></article>}
          {pendingItems.map((item) => (
            <article key={item.id} className={item.status === "needs_confirmation" ? "lost" : "won"}>
              <span>{item.selection}</span>
              <div>
                <MatchName item={item} matches={matches} />
                <small>
                  {item.status === "pending_quote"
                    ? "Esperando cuota fresca del proveedor"
                    : `La cuota paso de ${Number(item.offeredOdds).toFixed(2)} a ${Number(item.currentOdds || item.offeredOdds).toFixed(2)}`}
                </small>
              </div>
              <aside>
                {item.status === "needs_confirmation" ? (
                  <>
                    <button type="button" onClick={() => onAcceptPendingChange?.(item.id)}>Confirmar</button>
                    <button type="button" onClick={() => onCancelPendingChange?.(item.id)}>Cancelar</button>
                  </>
                ) : <b>PENDIENTE</b>}
              </aside>
            </article>
          ))}
        </section>
        <section className="apex-history">
          <div><h2>Historial reciente</h2><button>Ver Todo</button></div>
          {recentItems.map((item) => (
            <article key={item.id} className={item.status === "won" ? "won" : item.status === "lost" ? "lost" : ""}>
              <span>{item.selection}</span>
              <div>
                <MatchName item={item} matches={matches} />
                <small>
                  {["won", "lost"].includes(item.status)
                    ? `Elegiste ${selectionLabel(item)} · Resultado ${item.matchScore || item.matchResult || "-"} · Cuota ${Number(item.confirmedOdds || item.offeredOdds).toFixed(2)}`
                    : item.status === "pending" ? "Apuesta activa" : item.status === "pending_quote" ? "Pendiente de validacion" : item.status === "needs_confirmation" ? "Esperando tu confirmacion" : item.status === "cancelled" ? "Cancelada y reembolsada" : item.status}
                </small>
              </div>
              <aside><b>{statusLabel(item.status)}</b><em>{item.status === "won" ? `+${item.pointsWon}` : item.status === "lost" ? `-${item.pointsBet}` : item.pointsBet} Coins</em></aside>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
