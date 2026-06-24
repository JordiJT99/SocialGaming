import { useState } from "react";
import { AlertCircle, ChevronDown, CircleDot, Info, LoaderCircle, ShieldCheck, X } from "lucide-react";

export default function Sportsbook({ sportsData, onSportSelect, onAddToSlip, slipItems = [] }) {
  const [sportFilter, setSportFilter] = useState("all");
  const sports = [
    { key: "football", name: "Football" },
    { key: "basketball", name: "Basketball" },
    { key: "tennis", name: "Tennis" },
  ];
  const events = sportsData.matches.filter((match) =>
    match.status !== "finished" &&
    (sportFilter === "all" || (match.sportKey || "football") === sportFilter),
  );

  const handlePick = (event, pick, odd) => {
    if (event.status === "live") return;
    onAddToSlip?.(event, pick, odd);
  };

  return (
    <div className="product-page sportsbook-page">
      <header className="product-hero sportsbook-hero">
        <div><span className="product-eyebrow"><CircleDot size={15} /> Cuotas de Odds API</span><h1>Arma tu jugada</h1><p>Solo se muestran cuotas recibidas del proveedor. No se generan valores simulados.</p></div>
        <div className="virtual-only"><ShieldCheck size={18} /><div><strong>Modo gratuito</strong><span>Sin depósito ni retirada de dinero</span></div></div>
      </header>

      <div className="sportsbook-layout">
        <main>
          <div className="market-toolbar">
            <div className="market-sports">
              <button className={sportFilter === "all" ? "active" : ""} onClick={() => setSportFilter("all")}>Todos</button>
              {sports.map((sport) => <button className={sportFilter === sport.key ? "active" : ""} onClick={() => { setSportFilter(sport.key); onSportSelect?.(sport.key); }} key={sport.key}>{sport.name}</button>)}
            </div>
            <button className="competition-filter">Eventos disponibles <ChevronDown size={15} /></button>
          </div>
          {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando cuotas</strong></div>}
          {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error de Odds API</strong><p>{sportsData.error}</p></div>}
          {!sportsData.loading && !sportsData.error && events.length === 0 && <div className="api-state"><Info size={24} /><strong>No hay próximos eventos publicados</strong></div>}
          <div className="event-list">
            {events.map((event) => (
              <article className="bet-event" key={event.id}>
                <div className="event-info"><span>{event.league}</span><small>{new Date(event.date).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
                <div className="event-teams"><strong>{event.home}</strong><span>vs</span><strong>{event.away}</strong></div>
                {event.odds ? (
                  <div className="event-markets">
                    {[["1", event.odds[1]], ...(event.odds.X ? [["X", event.odds.X]] : []), ["2", event.odds[2]]].map(([pick, odd]) => {
                      const selected = slipItems.some((item) => item.eventId === event.id && item.selection === pick);
                      return <button disabled={event.status === "live"} className={selected ? "selected" : ""} onClick={() => handlePick(event, pick, odd)} key={pick}><span>{pick}</span><b>{odd.toFixed(2)}</b>{selected && <X size={12} />}</button>;
                    })}
                  </div>
                ) : <div className="odds-unavailable">Sin cuotas publicadas</div>}
                {event.status === "live"
                  ? <div className="odds-unavailable">Mercado cerrado durante el directo</div>
                  : event.odds && !event.bettingOpen && <div className="odds-unavailable">La cuota se validara despues de enviar la apuesta</div>}
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
