import { useState } from "react";
import { Award, BarChart3, Edit3, Flame, Medal, Plus, Share2, Swords, Target as TargetIcon, Trophy, UserPlus, Users } from "lucide-react";

function MatchName({ item, matches }) {
  const match = matches?.find((candidate) => candidate.id === item.matchId);
  const home = item.home || match?.home;
  const away = item.away || match?.away;
  const homeBadge = item.homeBadge || match?.homeBadge;
  const awayBadge = item.awayBadge || match?.awayBadge;
  const matchDate = item.matchDate || item.date || match?.date;

  let dateLabel = null;
  if (matchDate) {
    const d = new Date(matchDate);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const day = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
      if (diffDays === 0) {
        dateLabel = `Hoy · ${time}`;
      } else if (diffDays === 1) {
        dateLabel = `Mañana · ${time}`;
      } else if (diffDays === -1) {
        dateLabel = `Ayer · ${time}`;
      } else if (diffDays > 0 && diffDays <= 7) {
        dateLabel = `${day} · ${time}`;
      } else {
        dateLabel = `${day} · ${time}`;
      }
    }
  }

  return (
    <span className="apex-history-match">
      {homeBadge && <img src={homeBadge} alt="" />}
      <strong>{home && away ? `${home} vs ${away}` : item.matchId}</strong>
      {awayBadge && <img src={awayBadge} alt="" />}
      {dateLabel && <em className="apex-history-date">{dateLabel}</em>}
    </span>
  );
}

const MOCK_INVITES = [
  { id: "i1", username: "Marina", points: 17650, accuracy: 68, joinedAt: "2024-12-01", status: "active" },
  { id: "i2", username: "Alex", points: 16980, accuracy: 65, joinedAt: "2025-01-15", status: "active" },
  { id: "i3", username: "Claudia", points: 15320, accuracy: 70, joinedAt: "2025-02-08", status: "active" },
  { id: "i4", username: "Marc", points: 14890, accuracy: 63, joinedAt: "2025-03-22", status: "active" },
  { id: "i5", username: "Nora", points: 14210, accuracy: 67, joinedAt: "2025-04-11", status: "active" },
  { id: "i6", username: "Pablo", points: 13540, accuracy: 61, joinedAt: "2025-05-19", status: "active" },
];

const TABS = [
  { key: "jugadas", label: "Jugadas", icon: TargetIcon },
  { key: "quinielas", label: "Quinielas", icon: Trophy },
  { key: "desafios", label: "Desafíos", icon: Swords },
  { key: "racha", label: "Racha", icon: Flame },
  { key: "gamificacion", label: "Gamificación", icon: Award },
  { key: "invitados", label: "Invitados", icon: UserPlus },
  { key: "estadisticas", label: "Estadísticas", icon: BarChart3 },
];

export default function Profile({ store, user, matches, onAcceptPendingChange, onCancelPendingChange }) {
  const [activeTab, setActiveTab] = useState("jugadas");
  const predictions = store?.predictions?.filter((item) => item.userId === "current_user") || [];
  const pendingItems = predictions.filter((item) => ["pending_quote", "needs_confirmation"].includes(item.status));
  const recentItems = predictions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

  const totalWon = predictions.filter((p) => p.status === "won").reduce((s, p) => s + (p.pointsWon || 0), 0);
  const totalLost = predictions.filter((p) => p.status === "lost").reduce((s, p) => s + (p.pointsBet || 0), 0);
  const totalBet = predictions.reduce((s, p) => s + (p.pointsBet || 0), 0);
  const wonCount = predictions.filter((p) => p.status === "won").length;
  const lostCount = predictions.filter((p) => p.status === "lost").length;

  return (
    <div className="apex-page apex-profile-page">
      <section className="apex-profile-hero">
        <div className="apex-profile-avatar-wrap">
          <span className="apex-profile-monogram">{user?.username?.slice(0, 2).toUpperCase() || "JO"}</span>
          <b className="apex-profile-level">24</b>
        </div>
        <div className="apex-profile-info">
          <h1>{user?.username || "Jordi"}</h1>
          <p>◉ Analista Pro · Miembro desde 2023</p>
          <button><Edit3 size={16} /> Editar Perfil</button>
        </div>
      </section>

      <div className="apex-profile-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === "invitados" ? MOCK_INVITES.length : null;
          return (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {count != null && <em>{count}</em>}
            </button>
          );
        })}
      </div>

      {activeTab === "jugadas" && (
        <div className="apex-profile-content">
          <section className="apex-history">
            <div className="apex-history-head">
              <h2>Pendientes de cuota</h2>
              <span className="apex-history-count">{pendingItems.length}</span>
            </div>
            <p className="apex-quote-rule">Si la cuota lleva más de 5 minutos sin revisarse, quedará pendiente. Un cambio de hasta 0,20 se acepta automáticamente; si es mayor, tendrás que confirmarlo aquí.</p>
            {pendingItems.length === 0 && <article className="empty"><div><strong>No hay cuotas pendientes</strong><small>Las apuestas que necesiten validacion apareceran aqui.</small></div></article>}
            {pendingItems.map((item) => {
              const offered = Number(item.offeredOdds || 0);
              const current = Number(item.currentOdds || item.offeredOdds || 0);
              const potentialWin = offered > 0 ? Math.round(item.pointsBet * current) : 0;
              return (
                <article key={item.id} className={item.status === "needs_confirmation" ? "lost" : "won"}>
                  <span>{item.selection}</span>
                  <div>
                    <MatchName item={item} matches={matches} />
                    <small>
                      {item.status === "pending_quote"
                        ? `Esperando cuota fresca · Apuesta ${item.pointsBet} coins · Ganancia posible +${potentialWin} coins`
                        : `Cuota paso de ${offered.toFixed(2)} a ${current.toFixed(2)} · Ganancia posible +${potentialWin} coins`}
                    </small>
                  </div>
                  <aside>
                    <b className="apex-history-odds">@{current.toFixed(2)}</b>
                    {item.status === "needs_confirmation" ? (
                      <>
                        <button type="button" onClick={() => onAcceptPendingChange?.(item.id)}>Confirmar</button>
                        <button type="button" onClick={() => onCancelPendingChange?.(item.id)}>Cancelar</button>
                      </>
                    ) : <em className="apex-history-potential">+{potentialWin} coins</em>}
                  </aside>
                </article>
              );
            })}
          </section>
          <section className="apex-history">
            <div className="apex-history-head">
              <h2>Historial completo</h2>
              <button className="apex-link-btn">Ver Todo</button>
            </div>
            {recentItems.length === 0 && <article className="empty"><div><strong>Sin jugadas aún</strong><small>Cuando hagas una predicción aparecerá aquí.</small></div></article>}
            {recentItems.map((item) => {
              const betOdds = Number(item.confirmedOdds || item.offeredOdds || 0);
              const potentialWin = betOdds > 0 ? Math.round(item.pointsBet * betOdds) : 0;
              return (
                <article key={item.id} className={item.status === "won" ? "won" : item.status === "lost" ? "lost" : ""}>
                  <span>{item.selection}</span>
                  <div>
                    <MatchName item={item} matches={matches} />
                    <small>
                      {["won", "lost"].includes(item.status)
                        ? `Elegiste ${selectionLabel(item)} · Resultado ${item.matchScore || item.matchResult || "-"} · Cuota ${betOdds.toFixed(2)} · Ganancia ${item.status === "won" ? `+${item.pointsWon}` : `-${item.pointsBet}`} coins`
                        : item.status === "pending" ? `Apuesta activa · Cuota ${betOdds.toFixed(2)} · Ganancia posible +${potentialWin} coins` : item.status === "pending_quote" ? `Pendiente de validacion · Cuota ${betOdds.toFixed(2)}` : item.status === "needs_confirmation" ? `Esperando tu confirmacion · Cuota paso de ${Number(item.offeredOdds).toFixed(2)} a ${Number(item.currentOdds || item.offeredOdds).toFixed(2)}` : item.status === "cancelled" ? `Cancelada y reembolsada · Cuota ${betOdds.toFixed(2)}` : `${item.status} · Cuota ${betOdds.toFixed(2)}`}
                    </small>
                  </div>
                  <aside>
                    <b className="apex-history-odds">@{betOdds > 0 ? betOdds.toFixed(2) : "—"}</b>
                    {item.status === "won" ? <em className="apex-history-win">+{item.pointsWon} coins</em> : item.status === "lost" ? <em className="apex-history-loss">-{item.pointsBet} coins</em> : <em className="apex-history-potential">+{potentialWin} coins</em>}
                  </aside>
                </article>
              );
            })}
          </section>
        </div>
      )}

      {activeTab === "quinielas" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Mis Quinielas</h2>
          <p className="apex-section-subtitle">Tus combinaciones de pronósticos en distintos eventos</p>
          <div className="apex-empty-card">
            <Trophy size={40} />
            <strong>No tienes quinielas activas</strong>
            <small>Crea una quiniela combinando varios eventos desde la sección de Cuotas y mercados.</small>
            <a href="/sportsbook" className="apex-btn-primary">Ir a Cuotas y mercados</a>
          </div>
        </section>
      )}

      {activeTab === "desafios" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Mis Desafíos</h2>
          <p className="apex-section-subtitle">Competiciones 1 vs 1 con otros usuarios</p>
          <div className="apex-empty-card">
            <Swords size={40} />
            <strong>No tienes desafíos activos</strong>
            <small>Retá a otro usuario en la sección de Desafíos y demuestra quién sabe más.</small>
            <a href="/challenges" className="apex-btn-primary">Ir a Desafíos</a>
          </div>
        </section>
      )}

      {activeTab === "racha" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Tu Racha</h2>
          <p className="apex-section-subtitle">Mantén tu racha activa para conseguir recompensas diarias</p>

          <div className="apex-streak-hero">
            <Flame size={56} />
            <div>
              <strong>W{user?.streak || 0}</strong>
              <small>Días de racha</small>
            </div>
          </div>

          <div className="apex-streak-calendar">
            {Array.from({ length: 7 }).map((_, idx) => {
              const active = idx < (user?.streak || 0);
              return (
                <div key={idx} className={`apex-streak-day ${active ? "active" : ""}`}>
                  <span>{["L", "M", "X", "J", "V", "S", "D"][idx]}</span>
                  <b>{active ? "✓" : ""}</b>
                </div>
              );
            })}
          </div>

          <div className="apex-streak-rewards">
            <h3>Recompensas</h3>
            <article className="claimed">
              <span>Día 1</span>
              <b>+10 coins</b>
              <em>Conseguida</em>
            </article>
            <article className="claimed">
              <span>Día 3</span>
              <b>+30 coins</b>
              <em>Conseguida</em>
            </article>
            <article className="active">
              <span>Día 5</span>
              <b>+75 coins</b>
              <em>En curso</em>
            </article>
            <article className="locked">
              <span>Día 7</span>
              <b>+150 coins</b>
              <em>Bloqueada</em>
            </article>
            <article className="locked">
              <span>Día 14</span>
              <b>+500 coins</b>
              <em>Bloqueada</em>
            </article>
            <article className="locked">
              <span>Día 30</span>
              <b>+1.500 coins</b>
              <em>Bloqueada</em>
            </article>
          </div>
        </section>
      )}

      {activeTab === "medallas" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Medallas y Logros</h2>
          <p className="apex-section-subtitle">Tu colección de insignias y recompensas</p>
          <div className="apex-medals-grid">
            <article className="apex-medal unlocked">
              <span><Medal size={32} /></span>
              <b>Elite</b>
              <small>10 aciertos seguidos</small>
            </article>
            <article className="apex-medal locked">
              <span><Trophy size={32} /></span>
              <b>100 Wins</b>
              <small>Consigue 100 victorias</small>
            </article>
            <article className="apex-medal unlocked">
              <span><Flame size={32} /></span>
              <b>On Fire</b>
              <small>5 días de racha</small>
            </article>
            <article className="apex-medal unlocked">
              <span><TargetIcon size={32} /></span>
              <b>Oracle</b>
              <small>70% de acierto</small>
            </article>
            <article className="apex-medal locked">
              <span><Award size={32} /></span>
              <b>Maestro</b>
              <small>Llega al top 10</small>
            </article>
            <article className="apex-medal locked">
              <span><Users size={32} /></span>
              <b>Reclutador</b>
              <small>Invita a 10 amigos</small>
            </article>
            <article className="apex-medal add">
              <span><Plus size={32} /></span>
              <b>Próximamente</b>
            </article>
          </div>
        </section>
      )}

      {activeTab === "gamificacion" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Gamificación</h2>
          <p className="apex-section-subtitle">Tu progreso, nivel y objetivos desbloqueables</p>

          <div className="apex-game-level">
            <div className="apex-game-level-icon">
              <span>{user?.username?.slice(0, 1).toUpperCase() || "J"}</span>
              <b>24</b>
            </div>
            <div className="apex-game-level-info">
              <div className="apex-game-level-row">
                <strong>Nivel 24 — Analista Pro</strong>
                <small>2.450 / 3.000 XP</small>
              </div>
              <span className="apex-game-progress">
                <i style={{ width: "82%" }} />
              </span>
              <small>550 XP para Nivel 25 — Maestro Pronosticador</small>
            </div>
          </div>

          <h3 className="apex-game-section-title">Tus medallas</h3>
          <div className="apex-medals-grid">
            <article className="apex-medal unlocked">
              <span><Medal size={32} /></span>
              <b>Elite</b>
              <small>10 aciertos seguidos</small>
            </article>
            <article className="apex-medal unlocked">
              <span><Flame size={32} /></span>
              <b>On Fire</b>
              <small>5 días de racha</small>
            </article>
            <article className="apex-medal unlocked">
              <span><TargetIcon size={32} /></span>
              <b>Oracle</b>
              <small>70% de acierto</small>
            </article>
            <article className="apex-medal locked">
              <span><Trophy size={32} /></span>
              <b>100 Wins</b>
              <small>Consigue 100 victorias</small>
            </article>
            <article className="apex-medal locked">
              <span><Award size={32} /></span>
              <b>Maestro</b>
              <small>Llega al top 10</small>
            </article>
            <article className="apex-medal locked">
              <span><Users size={32} /></span>
              <b>Reclutador</b>
              <small>Invita a 10 amigos</small>
            </article>
          </div>

          <h3 className="apex-game-section-title">Objetivos diarios</h3>
          <div className="apex-game-goals">
            <article className="completed">
              <div>
                <strong>Login diario</strong>
                <small>+10 XP · Completado</small>
              </div>
              <b>✓</b>
            </article>
            <article className="completed">
              <div>
                <strong>Ver 3 anuncios</strong>
                <small>+25 XP · Completado</small>
              </div>
              <b>✓</b>
            </article>
            <article className="progress">
              <div>
                <strong>Gana 1 predicción</strong>
                <small>+50 XP · 0/1</small>
              </div>
              <span><i style={{ width: "0%" }} /></span>
            </article>
            <article className="progress">
              <div>
                <strong>Acierta 3 pronósticos</strong>
                <small>+100 XP · 2/3</small>
              </div>
              <span><i style={{ width: "66%" }} /></span>
            </article>
            <article className="locked">
              <div>
                <strong>Llega a 5.000 coins</strong>
                <small>+150 XP · 1.400/5.000</small>
              </div>
              <span><i style={{ width: "28%" }} /></span>
            </article>
          </div>
        </section>
      )}

      {activeTab === "invitados" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Mis Invitados</h2>
          <p className="apex-section-subtitle">Usuarios que se han unido con tu código de invitación</p>
          <div className="apex-invite-banner">
            <div>
              <Share2 size={20} />
              <div>
                <strong>Tu código: JORDI2025</strong>
                <small>Comparte y gana 50 coins por cada amigo que se una</small>
              </div>
            </div>
            <button type="button">Copiar enlace</button>
          </div>
          <div className="apex-invites-list">
            {MOCK_INVITES.map((inv) => (
              <article key={inv.id}>
                <span className="apex-invite-avatar">{inv.username.slice(0, 2).toUpperCase()}</span>
                <div className="apex-invite-info">
                  <strong>{inv.username}</strong>
                  <small>Se unió en {new Date(inv.joinedAt).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}</small>
                </div>
                <div className="apex-invite-stats">
                  <span><b>{inv.points.toLocaleString("es-ES")}</b> coins</span>
                  <span><b>{inv.accuracy}%</b> acierto</span>
                </div>
                <span className="apex-invite-status">+50</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "estadisticas" && (
        <section className="apex-profile-content">
          <h2 className="apex-section-title">Estadísticas</h2>
          <p className="apex-section-subtitle">Tu rendimiento detallado</p>

          <div className="apex-stats-highlight">
            <article>
              <span>ACIERTO</span>
              <strong>{user?.accuracy || 0}<em>%</em></strong>
            </article>
            <article>
              <span>PREDICCIONES</span>
              <strong>{user?.predictionsCount || 0}</strong>
            </article>
            <article>
              <span>PENDIENTES</span>
              <strong>{pendingItems.length}</strong>
            </article>
          </div>

          <div className="apex-stats-grid">
            <article>
              <span>Total apostado</span>
              <strong>{totalBet.toLocaleString("es-ES")} <em>coins</em></strong>
            </article>
            <article>
              <span>Total ganado</span>
              <strong style={{ color: "var(--green)" }}>+{totalWon.toLocaleString("es-ES")} <em>coins</em></strong>
            </article>
            <article>
              <span>Total perdido</span>
              <strong style={{ color: "var(--red)" }}>-{totalLost.toLocaleString("es-ES")} <em>coins</em></strong>
            </article>
            <article>
              <span>Balance neto</span>
              <strong style={{ color: totalWon - totalLost >= 0 ? "var(--green)" : "var(--red)" }}>
                {totalWon - totalLost >= 0 ? "+" : ""}{(totalWon - totalLost).toLocaleString("es-ES")} <em>coins</em>
              </strong>
            </article>
            <article>
              <span>Victorias</span>
              <strong>{wonCount}</strong>
            </article>
            <article>
              <span>Derrotas</span>
              <strong>{lostCount}</strong>
            </article>
            <article>
              <span>Racha actual</span>
              <strong>W{user?.streak || 0}</strong>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}
