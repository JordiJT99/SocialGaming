import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, CircleDot, Info, LoaderCircle, Minus, Plus, ShieldCheck, Trash2, X } from "lucide-react";

export default function Sportsbook({ sportsData }) {
  const [slip, setSlip] = useState([]);
  const [stake, setStake] = useState(100);
  const events = sportsData.matches.filter((match) => match.status !== "finished");
  const totalOdds = useMemo(() => slip.reduce((total, pick) => total * pick.odd, 1), [slip]);

  const togglePick = (event, pick, odd) => {
    setSlip((current) => {
      const withoutEvent = current.filter((item) => item.eventId !== event.id);
      const exists = current.some((item) => item.eventId === event.id && item.pick === pick);
      return exists ? withoutEvent : [...withoutEvent, { eventId: event.id, match: `${event.home} - ${event.away}`, pick, odd }];
    });
  };

  return (
    <div className="product-page sportsbook-page">
      <header className="product-hero sportsbook-hero">
        <div><span className="product-eyebrow"><CircleDot size={15} /> Cuotas de API-Football</span><h1>Arma tu jugada</h1><p>Solo se muestran cuotas recibidas del proveedor. No se generan valores simulados.</p></div>
        <div className="virtual-only"><ShieldCheck size={18} /><div><strong>Modo gratuito</strong><span>Sin depósito ni retirada de dinero</span></div></div>
      </header>

      <div className="sportsbook-layout">
        <main>
          <div className="market-toolbar"><div className="market-sports"><button className="active">Fútbol</button></div><button className="competition-filter">LaLiga 2025-2026 <ChevronDown size={15} /></button></div>
          {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando cuotas</strong></div>}
          {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error de API-Football</strong><p>{sportsData.error}</p></div>}
          {!sportsData.loading && !sportsData.error && events.length === 0 && <div className="api-state"><Info size={24} /><strong>No hay próximos eventos publicados</strong></div>}
          <div className="event-list">
            {events.map((event) => (
              <article className="bet-event" key={event.id}>
                <div className="event-info"><span>{event.league}</span><small>{new Date(event.date).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
                <div className="event-teams"><strong>{event.home}</strong><span>vs</span><strong>{event.away}</strong></div>
                {event.odds ? (
                  <div className="event-markets">
                    {[["1", event.odds[1]], ["X", event.odds.X], ["2", event.odds[2]]].map(([pick, odd]) => {
                      const selected = slip.some((item) => item.eventId === event.id && item.pick === pick);
                      return <button className={selected ? "selected" : ""} onClick={() => togglePick(event, pick, odd)} key={pick}><span>{pick}</span><b>{odd.toFixed(2)}</b>{selected && <X size={12} />}</button>;
                    })}
                  </div>
                ) : <div className="odds-unavailable">Sin cuotas publicadas</div>}
              </article>
            ))}
          </div>
        </main>

        <aside className="bet-slip panel">
          <div className="panel-heading"><div><span className="slip-count">{slip.length}</span><h2>Tu jugada</h2></div>{slip.length > 0 && <button onClick={() => setSlip([])}><Trash2 size={15} /></button>}</div>
          {slip.length === 0 ? <div className="slip-empty"><Plus size={25} /><strong>Selecciona una cuota</strong><p>Las selecciones aparecerán aquí.</p></div> : (
            <>
              <div className="slip-picks">{slip.map((item) => <div key={item.eventId}><button onClick={() => setSlip((current) => current.filter((pick) => pick.eventId !== item.eventId))}><X size={12} /></button><span>{item.match}</span><strong>{item.pick} · {item.odd.toFixed(2)}</strong></div>)}</div>
              <label className="stake-control"><span>Monedas en juego</span><div><button onClick={() => setStake(Math.max(50, stake - 50))}><Minus size={14} /></button><input value={stake} onChange={(event) => setStake(Number(event.target.value) || 0)} /><button onClick={() => setStake(stake + 50)}><Plus size={14} /></button></div></label>
              <div className="slip-summary"><span>Cuota total <b>{totalOdds.toFixed(2)}</b></span><span>Premio potencial <strong>{Math.round(stake * totalOdds).toLocaleString("es-ES")} P</strong></span></div>
              <button className="classic-button full">Jugar {stake.toLocaleString("es-ES")} coins</button>
            </>
          )}
          <div className="slip-disclaimer"><Info size={14} /> Datos de cuotas: API-Football.</div>
        </aside>
      </div>
    </div>
  );
}
